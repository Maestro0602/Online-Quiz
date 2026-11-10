import {
  User,
  UserRole,
  Quiz,
  Question,
  GameSession,
  Team,
  TeamMember,
  GameSummary,
  PlayerAnswerResult
} from '@quizchaos/shared';
import rawSeedData from '../data/mockDb.json';

const DB_STORAGE_KEY = 'qiuizez_m1_mock_db_v1';

interface MockDatabaseSchema {
  users: User[];
  quizzes: Quiz[];
  sessions: Record<string, GameSession>;
}

const TEAM_PRESETS = [
  { name: 'Red Rockets', color: '#e21b3c', badge: 'R' },
  { name: 'Blue Blasters', color: '#1368ce', badge: 'B' },
  { name: 'Golden Geeks', color: '#ffa602', badge: 'G' },
  { name: 'Green Giants', color: '#26890c', badge: 'V' }
];

// Simulated network delay (ms) so Loading states are clearly visible in the UI
let simulatedDelayMs = 420;
let forceNextError: string | null = null;

export function setMockNetworkDelay(ms: number): void {
  simulatedDelayMs = Math.max(0, ms);
}

export function triggerSimulatedApiError(message = 'Simulated 503 Mock API Service Unavailable'): void {
  forceNextError = message;
}

function delay(ms = simulatedDelayMs): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkForcedError(): void {
  if (forceNextError) {
    const msg = forceNextError;
    forceNextError = null;
    throw new Error(msg);
  }
}

function loadDb(): MockDatabaseSchema {
  try {
    const saved = localStorage.getItem(DB_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as MockDatabaseSchema;
    }
  } catch {
    // Fallback to seed JSON
  }

  const defaultSession = rawSeedData.defaultSession as unknown as GameSession;
  const initialDb: MockDatabaseSchema = {
    users: rawSeedData.users as User[],
    quizzes: rawSeedData.quizzes as unknown as Quiz[],
    sessions: {
      [defaultSession.room_code]: defaultSession
    }
  };
  saveDb(initialDb);
  return initialDb;
}

function saveDb(db: MockDatabaseSchema): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetMockDbToSeed(): MockDatabaseSchema {
  localStorage.removeItem(DB_STORAGE_KEY);
  return loadDb();
}

// ==========================================
// 1. AUTHENTICATION MOCK SERVICE
// ==========================================
export const authMockService = {
  async getDemoUsers(): Promise<User[]> {
    await delay(200);
    checkForcedError();
    const db = loadDb();
    return db.users;
  },

  async login(email: string, password?: string): Promise<{ user: User; token: string }> {
    await delay();
    checkForcedError();

    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    const db = loadDb();
    const found = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) {
      throw new Error('Invalid email or password. Try one of the 1-Click Demo accounts!');
    }

    return {
      user: found,
      token: `mock-jwt-token-${found.id}-${Date.now()}`
    };
  },

  async register(
    name: string,
    email: string,
    role: UserRole,
    password?: string,
    avatar?: string
  ): Promise<{ user: User; token: string }> {
    await delay();
    checkForcedError();

    if (!name || name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long.');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password is required (minimum 4 characters).');
    }

    const db = loadDb();
    const exists = db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (exists) {
      throw new Error('An account with this email already exists in the mock database.');
    }

    const cleanName = name.trim();
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: cleanName,
      email: email.trim().toLowerCase(),
      role,
      avatar: avatar || cleanName.substring(0, 2).toUpperCase()
    };

    db.users.push(newUser);
    saveDb(db);

    return {
      user: newUser,
      token: `mock-jwt-token-${newUser.id}`
    };
  }
};

// ==========================================
// 2. QUIZZES CRUD MOCK SERVICE
// ==========================================
export const quizMockService = {
  async getQuizzes(instructorId?: string): Promise<Quiz[]> {
    await delay();
    checkForcedError();
    const db = loadDb();
    if (instructorId) {
      const owned = db.quizzes.filter(q => q.instructor_id === instructorId);
      return owned.length > 0 ? owned : db.quizzes;
    }
    return db.quizzes;
  },

  async getQuizById(id: string): Promise<Quiz> {
    await delay();
    checkForcedError();
    const db = loadDb();
    const quiz = db.quizzes.find(q => q.id === id);
    if (!quiz) {
      throw new Error(`Quiz with ID "${id}" was not found.`);
    }
    return JSON.parse(JSON.stringify(quiz)) as Quiz;
  },

  async createQuiz(quizData: Partial<Quiz>): Promise<Quiz> {
    await delay();
    checkForcedError();

    if (!quizData.title || !quizData.title.trim()) {
      throw new Error('Quiz title is required.');
    }

    const db = loadDb();
    const quizId = `quiz-${Date.now()}`;
    const rawQuestions = quizData.questions || [];

    const normalizedQuestions: Question[] = rawQuestions.map((q, idx) => ({
      id: q.id || `q-${Date.now()}-${idx}`,
      quiz_id: quizId,
      prompt: q.prompt,
      options: q.options as [string, string, string, string],
      correct_option_index: q.correct_option_index,
      time_limit_seconds: q.time_limit_seconds || 20,
      base_points: q.base_points || 1000,
      order_index: idx
    }));

    const nowIso = new Date().toISOString();
    const newQuiz: Quiz = {
      id: quizId,
      instructor_id: quizData.instructor_id || 'inst-1',
      title: quizData.title.trim(),
      description: quizData.description?.trim() || '',
      is_published: quizData.is_published ?? true,
      created_at: nowIso,
      updated_at: nowIso,
      questions: normalizedQuestions
    };

    db.quizzes.unshift(newQuiz);
    saveDb(db);
    return newQuiz;
  },

  async updateQuiz(id: string, quizData: Partial<Quiz>): Promise<Quiz> {
    await delay();
    checkForcedError();

    const db = loadDb();
    const index = db.quizzes.findIndex(q => q.id === id);
    if (index === -1) {
      throw new Error(`Cannot update: Quiz "${id}" not found.`);
    }

    const existing = db.quizzes[index];
    const updatedQuestions: Question[] = (quizData.questions || existing.questions).map((q, idx) => ({
      id: q.id || `q-${Date.now()}-${idx}`,
      quiz_id: id,
      prompt: q.prompt,
      options: q.options as [string, string, string, string],
      correct_option_index: q.correct_option_index,
      time_limit_seconds: q.time_limit_seconds || 20,
      base_points: q.base_points || 1000,
      order_index: idx
    }));

    const updated: Quiz = {
      ...existing,
      title: quizData.title !== undefined ? quizData.title.trim() : existing.title,
      description: quizData.description !== undefined ? quizData.description.trim() : existing.description,
      is_published: quizData.is_published !== undefined ? quizData.is_published : existing.is_published,
      questions: updatedQuestions
    };

    db.quizzes[index] = updated;
    saveDb(db);
    return updated;
  },

  async deleteQuiz(id: string): Promise<boolean> {
    await delay(300);
    checkForcedError();
    const db = loadDb();
    db.quizzes = db.quizzes.filter(q => q.id !== id);
    saveDb(db);
    return true;
  },

  async togglePublish(id: string): Promise<Quiz> {
    await delay(250);
    checkForcedError();
    const db = loadDb();
    const quiz = db.quizzes.find(q => q.id === id);
    if (!quiz) {
      throw new Error('Quiz not found.');
    }
    quiz.is_published = !quiz.is_published;
    saveDb(db);
    return quiz;
  }
};

// ==========================================
// 3. GAME SESSIONS & MOCK REALTIME SERVICE
// ==========================================
export const sessionMockService = {
  async createSession(quizId: string, teamCount: number): Promise<GameSession> {
    await delay(350);
    checkForcedError();

    const db = loadDb();
    const quiz = db.quizzes.find(q => q.id === quizId) || db.quizzes[0];
    if (!quiz) {
      throw new Error('Please create a quiz before launching a session.');
    }

    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = `sess-${Date.now()}`;
    const count = Math.min(4, Math.max(2, teamCount));

    // Pre-populate 4 demo students across the teams so the Host Lobby & Spin Wheel can be tested immediately
    const demoStudents = db.users.filter(u => u.role === 'student' || u.role === 'user');

    const teams: Team[] = TEAM_PRESETS.slice(0, count).map((preset, idx) => ({
      id: `team-${sessionId}-${idx + 1}`,
      session_id: sessionId,
      name: preset.name,
      color: preset.color,
      badge: preset.badge,
      total_score: 0,
      members: []
    }));

    demoStudents.forEach((stu, idx) => {
      const targetTeam = teams[idx % teams.length];
      targetTeam.members.push({
        id: `mem-${sessionId}-${idx}`,
        team_id: targetTeam.id,
        user_id: stu.id,
        user_name: stu.name,
        avatar: stu.avatar || stu.name.substring(0, 2).toUpperCase(),
        individual_score: 0,
        is_online: true
      });
    });

    const newSession: GameSession = {
      id: sessionId,
      quiz_id: quiz.id,
      quiz_title: quiz.title,
      room_code: roomCode,
      status: 'lobby',
      team_count: count,
      current_question_index: 0,
      total_questions: quiz.questions.length,
      current_question: quiz.questions[0],
      host_user_id: 'inst-1',
      created_at: new Date().toISOString(),
      teams
    };

    db.sessions[roomCode] = newSession;
    saveDb(db);
    return newSession;
  },

  async getSession(roomCode: string): Promise<GameSession> {
    await delay(220);
    checkForcedError();
    const db = loadDb();
    const session = db.sessions[roomCode] || db.sessions['739218'];
    if (!session) {
      throw new Error(`Room PIN "${roomCode}" was not found.`);
    }
    const quiz = db.quizzes.find(q => q.id === session.quiz_id) || db.quizzes[0];
    if (quiz && !session.current_question) {
      session.current_question = quiz.questions[session.current_question_index] || quiz.questions[0];
    }
    return session;
  },

  async joinSession(
    roomCode: string,
    userId: string,
    userName: string,
    avatar?: string
  ): Promise<{ session: GameSession; team: Team; member: TeamMember }> {
    await delay(300);
    checkForcedError();

    const db = loadDb();
    const session = db.sessions[roomCode];
    if (!session) {
      throw new Error(`No active game room found with PIN "${roomCode}". Try demo PIN 739218!`);
    }

    // Check if player is already in a team
    for (const team of session.teams) {
      const existing = team.members.find(m => m.user_id === userId);
      if (existing) {
        return { session, team, member: existing };
      }
    }

    // Auto-balance: assign to team with fewest members
    const sortedTeams = [...session.teams].sort((a, b) => a.members.length - b.members.length);
    const targetTeam = sortedTeams[0];

    const newMember: TeamMember = {
      id: `mem-${Date.now()}`,
      team_id: targetTeam.id,
      user_id: userId,
      user_name: userName,
      avatar: avatar || userName.substring(0, 2).toUpperCase(),
      individual_score: 0,
      is_online: true
    };

    targetTeam.members.push(newMember);
    saveDb(db);
    return { session, team: targetTeam, member: newMember };
  },

  randomizeTeams(roomCode: string): GameSession | null {
    const db = loadDb();
    const session = db.sessions[roomCode];
    if (!session) return null;

    const allMembers: TeamMember[] = [];
    session.teams.forEach(t => {
      allMembers.push(...t.members);
      t.members = [];
    });

    // Fisher-Yates shuffle
    for (let i = allMembers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = allMembers[i];
      allMembers[i] = allMembers[j];
      allMembers[j] = temp;
    }

    allMembers.forEach((member, idx) => {
      const team = session.teams[idx % session.teams.length];
      member.team_id = team.id;
      team.members.push(member);
    });

    saveDb(db);
    return session;
  },

  startQuestion(roomCode: string, questionIndex = 0): GameSession | null {
    const db = loadDb();
    const session = db.sessions[roomCode];
    if (!session) return null;

    const quiz = db.quizzes.find(q => q.id === session.quiz_id) || db.quizzes[0];
    if (!quiz || questionIndex >= quiz.questions.length) {
      session.status = 'ended';
      saveDb(db);
      return session;
    }

    session.status = 'question_active';
    session.current_question_index = questionIndex;
    session.current_question = quiz.questions[questionIndex];
    session.time_remaining = quiz.questions[questionIndex].time_limit_seconds || 20;
    saveDb(db);
    return session;
  },

  submitAnswer(
    roomCode: string,
    userId: string,
    optionIndex: number,
    timeRemaining: number
  ): { session: GameSession; result: PlayerAnswerResult } | null {
    const db = loadDb();
    const session = db.sessions[roomCode];
    if (!session || !session.current_question) return null;

    const q = session.current_question;
    const isCorrect = optionIndex === q.correct_option_index;
    const speedRatio = Math.max(0, Math.min(1, timeRemaining / (q.time_limit_seconds || 20)));
    const pointsAwarded = isCorrect ? Math.round((q.base_points || 1000) * (0.5 + 0.5 * speedRatio)) : 0;

    let updatedTeamScore = 0;
    let updatedIndividualScore = 0;
    let matchedTeamName = 'Red Rockets';
    let matchedTeamId = 'team-1';

    for (const team of session.teams) {
      const member = team.members.find(m => m.user_id === userId);
      if (member) {
        member.individual_score += pointsAwarded;
        team.total_score += pointsAwarded;
        updatedIndividualScore = member.individual_score;
        updatedTeamScore = team.total_score;
        matchedTeamName = team.name;
        matchedTeamId = team.id;
        break;
      }
    }

    saveDb(db);
    return {
      session,
      result: {
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
        correct_option_index: q.correct_option_index,
        new_individual_score: updatedIndividualScore,
        new_team_score: updatedTeamScore,
        team_name: matchedTeamName,
        team_id: matchedTeamId
      }
    };
  },

  revealQuestionResult(roomCode: string): { session: GameSession; answerStats: number[] } | null {
    const db = loadDb();
    const session = db.sessions[roomCode];
    if (!session) return null;

    session.status = 'question_result';
    // Simulate realistic teammates' score progression in prototype mode
    session.teams.forEach(team => {
      team.members.forEach(m => {
        if (Math.random() > 0.35) {
          const bonus = Math.floor(650 + Math.random() * 320);
          m.individual_score += bonus;
          team.total_score += bonus;
        }
      });
    });

    saveDb(db);
    const correctIdx = session.current_question?.correct_option_index ?? 0;
    const stats = [1, 1, 0, 0];
    stats[correctIdx] = 3;
    return { session, answerStats: stats };
  },

  endSession(roomCode: string): GameSession | null {
    const db = loadDb();
    const session = db.sessions[roomCode];
    if (!session) return null;
    session.status = 'ended';
    saveDb(db);
    return session;
  },

  async getSummary(roomCode: string): Promise<GameSummary> {
    await delay(280);
    checkForcedError();
    const db = loadDb();
    const session = db.sessions[roomCode] || db.sessions['739218'];
    if (!session) {
      throw new Error(`Summary for room PIN "${roomCode}" not found.`);
    }

    const sortedTeams = [...session.teams].sort((a, b) => b.total_score - a.total_score);
    const contributors: GameSummary['top_contributors'] = [];

    sortedTeams.forEach(t => {
      t.members.forEach(m => {
        contributors.push({
          user_id: m.user_id,
          user_name: m.user_name,
          team_name: t.name,
          team_color: t.color,
          score: m.individual_score
        });
      });
    });

    contributors.sort((a, b) => b.score - a.score);

    return {
      session_id: session.id,
      quiz_title: session.quiz_title,
      room_code: session.room_code,
      total_participants: contributors.length,
      teams: sortedTeams,
      top_contributors: contributors
    };
  }
};
