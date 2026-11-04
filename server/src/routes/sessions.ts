import { Controller, Get, Post, Param, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { store, TEAM_PRESETS } from '../data/store.js';
import { GameSession, Team, TeamMember, TopContributor } from '@quizchaos/shared';

function generateRoomCode(): string {
  let code = '';
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (store.sessions.has(code));
  return code;
}

@Controller('api/sessions')
export class SessionsController {
  @Post()
  createSession(@Body() body: { quiz_id?: string; team_count?: number; host_user_id?: string }, @Res() res: Response) {
    const { quiz_id, team_count = 2, host_user_id } = body;

    const quiz = quiz_id ? store.quizzes.get(quiz_id) : undefined;
    if (!quiz) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Quiz not found' });
    }

    const validTeamCount = Math.max(2, Math.min(4, Number(team_count) || 2));
    const room_code = generateRoomCode();

    const teams: Team[] = [];
    for (let i = 0; i < validTeamCount; i++) {
      const preset = TEAM_PRESETS[i % TEAM_PRESETS.length];
      teams.push({
        id: `team-${room_code}-${i + 1}`,
        session_id: room_code,
        name: preset.name,
        color: preset.color,
        badge: preset.badge,
        total_score: 0,
        members: []
      });
    }

    const session: GameSession = {
      id: `session-${Date.now()}`,
      quiz_id: quiz.id,
      quiz_title: quiz.title,
      room_code,
      status: 'lobby',
      team_count: validTeamCount,
      teams,
      current_question_index: -1,
      total_questions: quiz.questions.length,
      host_user_id: host_user_id || 'host-user',
      created_at: new Date().toISOString()
    };

    store.sessions.set(room_code, session);
    return res.status(HttpStatus.CREATED).json({ session });
  }

  @Get(':roomCode')
  getSession(@Param('roomCode') roomCode: string, @Res() res: Response) {
    const session = store.sessions.get(roomCode);
    if (!session) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Game session not found or PIN is invalid' });
    }
    return res.status(HttpStatus.OK).json({ session });
  }

  @Post(':roomCode/join')
  joinSession(
    @Param('roomCode') roomCode: string,
    @Body() body: { user_id?: string; user_name?: string; avatar?: string },
    @Res() res: Response
  ) {
    const { user_id, user_name, avatar } = body;

    if (!user_id || !user_name) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'You must be signed in with a valid account to join.' });
    }

    const session = store.sessions.get(roomCode);
    if (!session) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Game PIN not found. Please verify the code and try again.' });
    }

    if (session.status === 'ended') {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'This game session has already ended.' });
    }

    for (const team of session.teams) {
      const existingMember = team.members.find(m => m.user_id === user_id);
      if (existingMember) {
        existingMember.is_online = true;
        if (avatar) existingMember.avatar = avatar;
        return res.status(HttpStatus.OK).json({
          session,
          team,
          member: existingMember,
          rejoined: true
        });
      }
    }

    let targetTeam = session.teams[0];
    for (const team of session.teams) {
      if (team.members.length < targetTeam.members.length) {
        targetTeam = team;
      }
    }

    const newMember: TeamMember = {
      id: `tm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id,
      user_name: user_name.trim(),
      team_id: targetTeam.id,
      individual_score: 0,
      is_online: true,
      avatar: avatar || user_name.substring(0, 2).toUpperCase()
    };

    targetTeam.members.push(newMember);

    return res.status(HttpStatus.OK).json({
      session,
      team: targetTeam,
      member: newMember,
      rejoined: false
    });
  }

  @Post(':roomCode/start')
  startSession(@Param('roomCode') roomCode: string, @Res() res: Response) {
    const session = store.sessions.get(roomCode);
    if (!session) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Session not found' });
    }

    const quiz = store.quizzes.get(session.quiz_id);
    if (!quiz || quiz.questions.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Quiz has no questions' });
    }

    session.status = 'question_active';
    session.current_question_index = 0;
    const q = quiz.questions[0];
    session.current_question = q;
    session.time_remaining = q.time_limit_seconds || 20;

    return res.status(HttpStatus.OK).json({ session });
  }

  @Post(':roomCode/next')
  nextQuestion(@Param('roomCode') roomCode: string, @Res() res: Response) {
    const session = store.sessions.get(roomCode);
    if (!session) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Session not found' });
    }

    const quiz = store.quizzes.get(session.quiz_id);
    if (!quiz) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Quiz not found' });
    }

    if (session.status === 'question_active') {
      session.status = 'question_result';
      return res.status(HttpStatus.OK).json({ session });
    }

    const nextIdx = session.current_question_index + 1;
    if (nextIdx < quiz.questions.length) {
      session.current_question_index = nextIdx;
      session.current_question = quiz.questions[nextIdx];
      session.time_remaining = quiz.questions[nextIdx].time_limit_seconds || 20;
      session.status = 'question_active';
    } else {
      session.status = 'ended';
    }

    return res.status(HttpStatus.OK).json({ session });
  }

  @Post(':roomCode/end')
  endSession(@Param('roomCode') roomCode: string, @Res() res: Response) {
    const session = store.sessions.get(roomCode);
    if (!session) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Session not found' });
    }

    session.status = 'ended';
    return res.status(HttpStatus.OK).json({ session });
  }

  @Get(':roomCode/summary')
  getSessionSummary(@Param('roomCode') roomCode: string, @Res() res: Response) {
    const session = store.sessions.get(roomCode);
    if (!session) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Session not found' });
    }

    const sortedTeams = [...session.teams].sort((a, b) => b.total_score - a.total_score);
    const allMembers: TopContributor[] = [];
    let totalParticipants = 0;

    session.teams.forEach(team => {
      totalParticipants += team.members.length;
      team.members.forEach(member => {
        allMembers.push({
          user_id: member.user_id,
          user_name: member.user_name,
          team_name: team.name,
          team_color: team.color,
          score: member.individual_score
        });
      });
    });

    allMembers.sort((a, b) => b.score - a.score);

    return res.status(HttpStatus.OK).json({
      session_id: session.id,
      room_code: session.room_code,
      quiz_title: session.quiz_title,
      teams: sortedTeams,
      top_contributors: allMembers.slice(0, 5),
      total_participants: totalParticipants
    });
  }
}
