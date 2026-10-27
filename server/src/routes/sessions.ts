import { Router, Request, Response } from 'express';
import { store, TEAM_PRESETS } from '../data/store.js';
import { GameSession, Team, TeamMember, TopContributor } from '@quizchaos/shared';

const router = Router();

// Generate unique 6-digit room PIN
function generateRoomCode(): string {
  let code = '';
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (store.sessions.has(code));
  return code;
}

// POST /api/sessions - Launch session (Story 2)
router.post('/', (req: Request, res: Response) => {
  const { quiz_id, team_count = 2, host_user_id } = req.body;

  const quiz = store.quizzes.get(quiz_id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  const validTeamCount = Math.max(2, Math.min(4, Number(team_count) || 2));
  const room_code = generateRoomCode();

  // Create balanced teams
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
  res.status(201).json({ session });
});

// GET /api/sessions/:roomCode - Get session state
router.get('/:roomCode', (req: Request, res: Response) => {
  const session = store.sessions.get(req.params.roomCode);
  if (!session) {
    return res.status(404).json({ error: 'Game session not found or PIN is invalid' });
  }
  res.json({ session });
});

// POST /api/sessions/:roomCode/join - Join session with balanced team distribution (Story 3)
router.post('/:roomCode/join', (req: Request, res: Response) => {
  const { roomCode } = req.params;
  const { user_id, user_name, avatar } = req.body;

  if (!user_id || !user_name) {
    return res.status(401).json({ error: 'You must be signed in with a valid student account to join.' });
  }

  const session = store.sessions.get(roomCode);
  if (!session) {
    return res.status(404).json({ error: 'Game PIN not found. Please verify the code and try again.' });
  }

  if (session.status === 'ended') {
    return res.status(400).json({ error: 'This game session has already ended.' });
  }

  // Check if student already in one of the teams
  for (const team of session.teams) {
    const existingMember = team.members.find(m => m.user_id === user_id);
    if (existingMember) {
      existingMember.is_online = true;
      if (avatar) existingMember.avatar = avatar;
      return res.json({
        session,
        team,
        member: existingMember,
        rejoined: true
      });
    }
  }

  // Automated balanced team distribution:
  // Find team with lowest number of members
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
    avatar: avatar || '🦊'
  };

  targetTeam.members.push(newMember);

  res.status(200).json({
    session,
    team: targetTeam,
    member: newMember,
    rejoined: false
  });
});

// POST /api/sessions/:roomCode/start - Host starts game
router.post('/:roomCode/start', (req: Request, res: Response) => {
  const session = store.sessions.get(req.params.roomCode);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const quiz = store.quizzes.get(session.quiz_id);
  if (!quiz || quiz.questions.length === 0) {
    return res.status(400).json({ error: 'Quiz has no questions' });
  }

  session.status = 'question_active';
  session.current_question_index = 0;
  const q = quiz.questions[0];
  session.current_question = q;
  session.time_remaining = q.time_limit_seconds || 20;

  res.json({ session });
});

// POST /api/sessions/:roomCode/next - Advance to next question or end
router.post('/:roomCode/next', (req: Request, res: Response) => {
  const session = store.sessions.get(req.params.roomCode);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const quiz = store.quizzes.get(session.quiz_id);
  if (!quiz) {
    return res.status(400).json({ error: 'Quiz not found' });
  }

  if (session.status === 'question_active') {
    // Show question results & current question leaderboard
    session.status = 'question_result';
    return res.json({ session });
  }

  // Move to next question or finish
  const nextIdx = session.current_question_index + 1;
  if (nextIdx < quiz.questions.length) {
    session.current_question_index = nextIdx;
    session.current_question = quiz.questions[nextIdx];
    session.time_remaining = quiz.questions[nextIdx].time_limit_seconds || 20;
    session.status = 'question_active';
  } else {
    session.status = 'ended';
  }

  res.json({ session });
});

// POST /api/sessions/:roomCode/end - Manually end session (Story 6)
router.post('/:roomCode/end', (req: Request, res: Response) => {
  const session = store.sessions.get(req.params.roomCode);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.status = 'ended';
  res.json({ session });
});

// GET /api/sessions/:roomCode/summary - Post-game summary (Story 7)
router.get('/:roomCode/summary', (req: Request, res: Response) => {
  const session = store.sessions.get(req.params.roomCode);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Sort teams by total_score descending
  const sortedTeams = [...session.teams].sort((a, b) => b.total_score - a.total_score);

  // Collect top contributors across all teams
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

  res.json({
    session_id: session.id,
    room_code: session.room_code,
    quiz_title: session.quiz_title,
    teams: sortedTeams,
    top_contributors: allMembers.slice(0, 5),
    total_participants: totalParticipants
  });
});

export default router;
