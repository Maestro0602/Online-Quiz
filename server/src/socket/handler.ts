import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { store } from '../data/store.js';
import { TeamMember } from '@quizchaos/shared';

// Track student answers per question in memory: `${roomCode}:${questionId}` -> Map<userId, answer>
const answerRecords = new Map<string, Map<string, { selectedIndex: number; points: number; isCorrect: boolean }>>();

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})
export class GameGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('session:join')
  handleJoinSession(
    @MessageBody() data: { room_code: string; user_id: string; role?: string },
    @ConnectedSocket() socket: Socket
  ) {
    const { room_code } = data;
    socket.join(room_code);

    const session = store.sessions.get(room_code);
    if (session) {
      this.server.to(room_code).emit('session:updated', session);
    }
  }

  @SubscribeMessage('session:randomize_teams')
  handleRandomizeTeams(@MessageBody() data: { room_code: string }) {
    const { room_code } = data;
    const session = store.sessions.get(room_code);
    if (!session || session.status !== 'lobby' || session.teams.length === 0) return;

    const allMembers: TeamMember[] = [];
    for (const team of session.teams) {
      allMembers.push(...team.members);
      team.members = [];
    }

    for (let i = allMembers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allMembers[i], allMembers[j]] = [allMembers[j], allMembers[i]];
    }

    allMembers.forEach((member, index) => {
      const targetTeam = session.teams[index % session.teams.length];
      member.team_id = targetTeam.id;
      targetTeam.members.push(member);
    });

    this.server.to(room_code).emit('session:updated', session);
    this.server.to(room_code).emit('teams:randomized', {
      teams: session.teams
    });
  }

  @SubscribeMessage('session:start')
  handleStartSession(@MessageBody() data: { room_code: string }) {
    const { room_code } = data;
    const session = store.sessions.get(room_code);
    if (!session) return;

    const quiz = store.quizzes.get(session.quiz_id);
    if (!quiz || quiz.questions.length === 0) return;

    session.status = 'question_active';
    session.current_question_index = 0;
    session.current_question = quiz.questions[0];
    session.time_remaining = quiz.questions[0].time_limit_seconds || 20;

    this.server.to(room_code).emit('session:updated', session);
    this.server.to(room_code).emit('question:started', {
      question_index: 0,
      total_questions: quiz.questions.length,
      time_limit: session.time_remaining
    });
  }

  @SubscribeMessage('player:submit_answer')
  handleSubmitAnswer(
    @MessageBody()
    data: {
      room_code: string;
      user_id: string;
      question_id: string;
      selected_option_index: number;
      time_remaining: number;
    },
    @ConnectedSocket() socket: Socket
  ) {
    const { room_code, user_id, question_id, selected_option_index, time_remaining } = data;
    const session = store.sessions.get(room_code);
    if (!session || session.status !== 'question_active') return;

    const quiz = store.quizzes.get(session.quiz_id);
    if (!quiz) return;

    const currentQuestion = quiz.questions[session.current_question_index];
    if (!currentQuestion || currentQuestion.id !== question_id) return;

    const answerKey = `${room_code}:${question_id}`;
    if (!answerRecords.has(answerKey)) {
      answerRecords.set(answerKey, new Map());
    }
    const qAnswers = answerRecords.get(answerKey)!;

    if (qAnswers.has(user_id)) {
      return;
    }

    const isCorrect = selected_option_index === currentQuestion.correct_option_index;
    let pointsAwarded = 0;

    if (isCorrect) {
      const totalTime = currentQuestion.time_limit_seconds || 20;
      const speedRatio = Math.max(0, Math.min(1, time_remaining / totalTime));
      pointsAwarded = Math.round(currentQuestion.base_points * (0.5 + 0.5 * speedRatio));
    }

    qAnswers.set(user_id, {
      selectedIndex: selected_option_index,
      points: pointsAwarded,
      isCorrect
    });

    let studentMember: TeamMember | undefined;
    const studentTeam = session.teams.find(t => {
      studentMember = t.members.find(m => m.user_id === user_id);
      return !!studentMember;
    });

    if (studentMember && studentTeam) {
      studentMember.individual_score += pointsAwarded;
      studentTeam.total_score += pointsAwarded;
    }

    socket.emit('player:answer_result', {
      is_correct: isCorrect,
      correct_option_index: currentQuestion.correct_option_index,
      points_awarded: pointsAwarded,
      new_individual_score: studentMember?.individual_score || 0,
      new_team_score: studentTeam?.total_score || 0,
      team_name: studentTeam?.name || '',
      team_id: studentTeam?.id || ''
    });

    this.server.to(room_code).emit('score:updated', {
      team_id: studentTeam?.id,
      team_score: studentTeam?.total_score,
      member_id: studentMember?.id,
      member_score: studentMember?.individual_score,
      points_awarded: pointsAwarded,
      is_correct: isCorrect
    });

    this.server.to(room_code).emit('leaderboard:refreshed', session.teams);
    this.server.to(room_code).emit('session:updated', session);
  }

  @SubscribeMessage('session:show_result')
  handleShowResult(@MessageBody() data: { room_code: string }) {
    const { room_code } = data;
    const session = store.sessions.get(room_code);
    if (!session) return;

    const quiz = store.quizzes.get(session.quiz_id);
    if (!quiz) return;

    const currentQuestion = quiz.questions[session.current_question_index];
    if (!currentQuestion) return;

    session.status = 'question_result';

    const answerKey = `${room_code}:${currentQuestion.id}`;
    const qAnswers = answerRecords.get(answerKey) || new Map();
    const stats = [0, 0, 0, 0];
    qAnswers.forEach(ans => {
      if (ans.selectedIndex >= 0 && ans.selectedIndex < 4) {
        stats[ans.selectedIndex]++;
      }
    });

    this.server.to(room_code).emit('session:updated', session);
    this.server.to(room_code).emit('question:ended', {
      correct_option_index: currentQuestion.correct_option_index,
      answer_stats: stats,
      leaderboard: session.teams
    });
  }

  @SubscribeMessage('session:next_question')
  handleNextQuestion(@MessageBody() data: { room_code: string }) {
    const { room_code } = data;
    const session = store.sessions.get(room_code);
    if (!session) return;

    const quiz = store.quizzes.get(session.quiz_id);
    if (!quiz) return;

    const nextIndex = session.current_question_index + 1;
    if (nextIndex < quiz.questions.length) {
      session.current_question_index = nextIndex;
      session.current_question = quiz.questions[nextIndex];
      session.time_remaining = quiz.questions[nextIndex].time_limit_seconds || 20;
      session.status = 'question_active';

      this.server.to(room_code).emit('session:updated', session);
      this.server.to(room_code).emit('question:started', {
        question_index: nextIndex,
        total_questions: quiz.questions.length,
        time_limit: session.time_remaining
      });
    } else {
      session.status = 'ended';
      this.server.to(room_code).emit('session:updated', session);
      this.server.to(room_code).emit('session:ended', {
        final_leaderboard: session.teams
      });
    }
  }

  @SubscribeMessage('session:end')
  handleEndSession(@MessageBody() data: { room_code: string }) {
    const { room_code } = data;
    const session = store.sessions.get(room_code);
    if (!session) return;

    session.status = 'ended';
    this.server.to(room_code).emit('session:updated', session);
    this.server.to(room_code).emit('session:ended', {
      final_leaderboard: session.teams
    });
  }
}
