import { Server, Socket } from 'socket.io';
import { store } from '../data/store.js';
import { GameSession, TeamMember } from '@quizchaos/shared';

// Track student answers per question in memory: `${roomCode}:${questionId}` -> Map<userId, answer>
const answerRecords = new Map<string, Map<string, { selectedIndex: number; points: number; isCorrect: boolean }>>();

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // Student or Host joins session room
    socket.on('session:join', (data: { room_code: string; user_id: string; role?: string }) => {
      const { room_code } = data;
      socket.join(room_code);

      const session = store.sessions.get(room_code);
      if (session) {
        // Broadcast current session state to room
        io.to(room_code).emit('session:updated', session);
      }
    });

    // Host starts the game
    socket.on('session:start', (data: { room_code: string }) => {
      const { room_code } = data;
      const session = store.sessions.get(room_code);
      if (!session) return;

      const quiz = store.quizzes.get(session.quiz_id);
      if (!quiz || quiz.questions.length === 0) return;

      session.status = 'question_active';
      session.current_question_index = 0;
      session.current_question = quiz.questions[0];
      session.time_remaining = quiz.questions[0].time_limit_seconds || 20;

      // Broadcast update
      io.to(room_code).emit('session:updated', session);
      io.to(room_code).emit('question:started', {
        question_index: 0,
        total_questions: quiz.questions.length,
        time_limit: session.time_remaining
      });
    });

    // Student submits answer (Story 4 & 5)
    socket.on('player:submit_answer', (data: {
      room_code: string;
      user_id: string;
      question_id: string;
      selected_option_index: number;
      time_remaining: number;
    }) => {
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

      // Prevent duplicate submissions for same question
      if (qAnswers.has(user_id)) {
        return;
      }

      const isCorrect = selected_option_index === currentQuestion.correct_option_index;
      let pointsAwarded = 0;

      if (isCorrect) {
        // Kahoot-style speed bonus points calculation:
        // Base points + speed fraction (between 50% and 100% of base points)
        const totalTime = currentQuestion.time_limit_seconds || 20;
        const speedRatio = Math.max(0, Math.min(1, time_remaining / totalTime));
        pointsAwarded = Math.round(currentQuestion.base_points * (0.5 + 0.5 * speedRatio));
      }

      qAnswers.set(user_id, {
        selectedIndex: selected_option_index,
        points: pointsAwarded,
        isCorrect
      });

      // Find user's team and update scores (Story 5: Individual contributes directly to cumulative team score)
      let studentMember: TeamMember | undefined;
      let studentTeam = session.teams.find(t => {
        studentMember = t.members.find(m => m.user_id === user_id);
        return !!studentMember;
      });

      if (studentMember && studentTeam) {
        studentMember.individual_score += pointsAwarded;
        studentTeam.total_score += pointsAwarded;
      }

      // Send private result back to this specific player socket
      socket.emit('player:answer_result', {
        is_correct: isCorrect,
        correct_option_index: currentQuestion.correct_option_index,
        points_awarded: pointsAwarded,
        new_individual_score: studentMember?.individual_score || 0,
        new_team_score: studentTeam?.total_score || 0,
        team_name: studentTeam?.name || '',
        team_id: studentTeam?.id || ''
      });

      // Broadcast score and team leaderboard update in real-time to all clients!
      io.to(room_code).emit('score:updated', {
        team_id: studentTeam?.id,
        team_score: studentTeam?.total_score,
        member_id: studentMember?.id,
        member_score: studentMember?.individual_score,
        points_awarded: pointsAwarded,
        is_correct: isCorrect
      });

      io.to(room_code).emit('leaderboard:refreshed', session.teams);
      io.to(room_code).emit('session:updated', session);
    });

    // Host shows question answer & stats
    socket.on('session:show_result', (data: { room_code: string }) => {
      const { room_code } = data;
      const session = store.sessions.get(room_code);
      if (!session) return;

      const quiz = store.quizzes.get(session.quiz_id);
      if (!quiz) return;

      const currentQuestion = quiz.questions[session.current_question_index];
      if (!currentQuestion) return;

      session.status = 'question_result';

      // Calculate answer distribution breakdown
      const answerKey = `${room_code}:${currentQuestion.id}`;
      const qAnswers = answerRecords.get(answerKey) || new Map();
      const stats = [0, 0, 0, 0];
      qAnswers.forEach(ans => {
        if (ans.selectedIndex >= 0 && ans.selectedIndex < 4) {
          stats[ans.selectedIndex]++;
        }
      });

      io.to(room_code).emit('session:updated', session);
      io.to(room_code).emit('question:ended', {
        correct_option_index: currentQuestion.correct_option_index,
        answer_stats: stats,
        leaderboard: session.teams
      });
    });

    // Host advances to next question or end
    socket.on('session:next_question', (data: { room_code: string }) => {
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

        io.to(room_code).emit('session:updated', session);
        io.to(room_code).emit('question:started', {
          question_index: nextIndex,
          total_questions: quiz.questions.length,
          time_limit: session.time_remaining
        });
      } else {
        session.status = 'ended';
        io.to(room_code).emit('session:updated', session);
        io.to(room_code).emit('session:ended', {
          final_leaderboard: session.teams
        });
      }
    });

    // Host manually ends session (Story 6)
    socket.on('session:end', (data: { room_code: string }) => {
      const { room_code } = data;
      const session = store.sessions.get(room_code);
      if (!session) return;

      session.status = 'ended';
      io.to(room_code).emit('session:updated', session);
      io.to(room_code).emit('session:ended', {
        final_leaderboard: session.teams
      });
    });
  });
}
