import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { store, TEAM_PRESETS } from '../data/store.js';
import { dbSaveSession } from '../db/index.js';
import { GameSession, Team, TeamMember } from '@quizchaos/shared';

function getTotalPlayers(session: GameSession): number {
  return session.teams.reduce((sum, t) => sum + t.members.length, 0);
}

// Track student answers per question in memory: `${roomCode}:${questionId}` -> Map<userId, answer>
const answerRecords = new Map<string, Map<string, { selectedIndex: number; points: number; isCorrect: boolean }>>();
const awardedTeamSyncBonuses = new Set<string>();

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
    void dbSaveSession(session);
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
    this.server.to(room_code).emit('question:progress', {
      answers_received: 0,
      total_players: getTotalPlayers(session)
    });
    void dbSaveSession(session);
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

    this.server.to(room_code).emit('question:progress', {
      answers_received: qAnswers.size,
      total_players: getTotalPlayers(session)
    });

    let studentMember: TeamMember | undefined;
    const studentTeam = session.teams.find(t => {
      studentMember = t.members.find(m => m.user_id === user_id);
      return !!studentMember;
    });

    if (studentMember && studentTeam) {
      studentMember.individual_score += pointsAwarded;
      studentTeam.total_score += pointsAwarded;

      this.server.to(room_code).emit('team:member_picked', {
        team_id: studentTeam.id,
        user_id: studentMember.user_id,
        user_name: studentMember.user_name,
        avatar: studentMember.avatar || studentMember.user_name.substring(0, 2).toUpperCase(),
        selected_option_index
      });

      const bonusKey = `${room_code}:${question_id}:${studentTeam.id}`;
      if (
        !awardedTeamSyncBonuses.has(bonusKey) &&
        studentTeam.members.length >= 2 &&
        studentTeam.members.every(
          m =>
            qAnswers.has(m.user_id) &&
            qAnswers.get(m.user_id)?.selectedIndex === currentQuestion.correct_option_index
        )
      ) {
        awardedTeamSyncBonuses.add(bonusKey);
        const bonusPoints = 100;
        studentTeam.total_score += bonusPoints;
        this.server.to(room_code).emit('team:sync_bonus', {
          team_id: studentTeam.id,
          team_name: studentTeam.name,
          bonus_points: bonusPoints,
          updated_team_score: studentTeam.total_score
        });
      }
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
    void dbSaveSession(session);
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
    void dbSaveSession(session);
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
      this.server.to(room_code).emit('question:progress', {
        answers_received: 0,
        total_players: getTotalPlayers(session)
      });
    } else {
      session.status = 'ended';
      this.server.to(room_code).emit('session:updated', session);
      this.server.to(room_code).emit('session:ended', {
        final_leaderboard: session.teams
      });
    }
    void dbSaveSession(session);
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
    void dbSaveSession(session);
  }

  @SubscribeMessage('session:add_player')
  handleAddPlayer(
    @MessageBody() data: { room_code: string; user_name: string; avatar?: string }
  ) {
    const { room_code, user_name, avatar } = data;
    const session = store.sessions.get(room_code);
    const cleanName = user_name?.trim();
    if (!session || session.status !== 'lobby' || session.teams.length === 0 || !cleanName) return;

    const targetTeam = session.teams.reduce(
      (min, t) => (t.members.length < min.members.length ? t : min),
      session.teams[0]
    );

    const suffix = Math.random().toString(36).slice(2, 6);
    const newMember: TeamMember = {
      id: `tm-${Date.now()}-${suffix}`,
      user_id: `manual-${Date.now()}-${suffix}`,
      user_name: cleanName,
      team_id: targetTeam.id,
      individual_score: 0,
      is_online: true,
      avatar: avatar || cleanName.substring(0, 2).toUpperCase()
    };

    targetTeam.members.push(newMember);
    this.server.to(room_code).emit('session:updated', session);
    void dbSaveSession(session);
  }

  @SubscribeMessage('session:remove_player')
  handleRemovePlayer(@MessageBody() data: { room_code: string; member_id: string }) {
    const { room_code, member_id } = data;
    const session = store.sessions.get(room_code);
    if (!session || session.status !== 'lobby') return;

    for (const team of session.teams) {
      team.members = team.members.filter(m => m.id !== member_id && m.user_id !== member_id);
    }

    this.server.to(room_code).emit('session:updated', session);
    void dbSaveSession(session);
  }

  @SubscribeMessage('session:set_team_count')
  handleSetTeamCount(@MessageBody() data: { room_code: string; team_count: number }) {
    const { room_code, team_count } = data;
    const session = store.sessions.get(room_code);
    if (!session || session.status !== 'lobby') return;

    const count = Math.max(2, Math.min(4, Number(team_count) || 2));
    const allMembers: TeamMember[] = [];
    for (const team of session.teams) {
      allMembers.push(...team.members);
    }

    const nextTeams: Team[] = [];
    for (let i = 0; i < count; i++) {
      const preset = TEAM_PRESETS[i % TEAM_PRESETS.length];
      nextTeams.push({
        id: `team-${room_code}-${i + 1}`,
        session_id: room_code,
        name: preset.name,
        color: preset.color,
        badge: preset.badge,
        total_score: 0,
        members: []
      });
    }

    allMembers.forEach((member, idx) => {
      const targetTeam = nextTeams[idx % count];
      member.team_id = targetTeam.id;
      targetTeam.members.push(member);
    });

    session.teams = nextTeams;
    session.team_count = count;
    this.server.to(room_code).emit('session:updated', session);
    void dbSaveSession(session);
  }
}
