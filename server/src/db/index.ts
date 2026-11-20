import pg from 'pg';
import dotenv from 'dotenv';
import { store } from '../data/store.js';
import {
  User,
  UserRole,
  Quiz,
  Question,
  GameSession,
  SessionStatus,
  Team,
  TeamMember
} from '@quizchaos/shared';

dotenv.config();

const { Pool } = pg;

export const hasDbUrl = !!process.env.DATABASE_URL;
export let isDbConnected = false;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined
});

const writeQueues = new Map<string, Promise<void>>();

function enqueueWrite(key: string, task: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(task)
    .catch(err => {
      console.error(`[DB] Write failed for ${key}:`, err instanceof Error ? err.message : err);
    });
  writeQueues.set(key, next);
  return next;
}

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

export async function initDatabase() {
  if (!hasDbUrl) {
    console.log('[DB] No DATABASE_URL found. Operating in in-memory mode.');
    return false;
  }

  try {
    const client = await pool.connect();
    console.log('[DB] Connected to PostgreSQL database.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL DEFAULT 'password123',
        avatar VARCHAR(50) DEFAULT 'U',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR(255) PRIMARY KEY,
        instructor_id VARCHAR(255) NOT NULL,
        instructor_name VARCHAR(255) DEFAULT 'Instructor',
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        is_published BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id VARCHAR(255) PRIMARY KEY,
        quiz_id VARCHAR(255) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option_index INT NOT NULL,
        base_points INT DEFAULT 1000,
        time_limit_seconds INT DEFAULT 20,
        code_snippet TEXT,
        image_url TEXT,
        order_index INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS game_sessions (
        id VARCHAR(255) PRIMARY KEY,
        quiz_id VARCHAR(255) NOT NULL,
        quiz_title VARCHAR(255) NOT NULL,
        room_code VARCHAR(20) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'lobby',
        team_count INT DEFAULT 2,
        current_question_index INT DEFAULT -1,
        total_questions INT DEFAULT 0,
        host_user_id VARCHAR(255) NOT NULL,
        is_locked BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) NOT NULL,
        badge VARCHAR(50) NOT NULL,
        total_score INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS team_members (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        team_id VARCHAR(255) NOT NULL,
        individual_score INT DEFAULT 0,
        is_online BOOLEAN DEFAULT true,
        avatar VARCHAR(50) DEFAULT 'U'
      );

      ALTER TABLE questions ADD COLUMN IF NOT EXISTS code_snippet TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
    `);

    // Seed default users idempotently
    for (const u of store.users.values()) {
      await client.query(
        `INSERT INTO users (id, name, email, role, password, avatar)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [u.id, u.name, u.email, u.role, u.password || 'password123', u.avatar || 'U']
      );
    }

    // Seed default quizzes and questions idempotently
    for (const q of store.quizzes.values()) {
      await client.query(
        `INSERT INTO quizzes (id, instructor_id, instructor_name, title, description, is_published, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          q.id,
          q.instructor_id,
          q.instructor_name || 'Instructor',
          q.title,
          q.description || '',
          !!q.is_published,
          q.created_at || new Date().toISOString(),
          q.updated_at || new Date().toISOString()
        ]
      );

      for (let idx = 0; idx < q.questions.length; idx++) {
        const ques = q.questions[idx];
        await client.query(
          `INSERT INTO questions (id, quiz_id, prompt, options, correct_option_index, base_points, time_limit_seconds, code_snippet, image_url, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            ques.id,
            q.id,
            ques.prompt,
            JSON.stringify(ques.options),
            ques.correct_option_index,
            ques.base_points || 1000,
            ques.time_limit_seconds || 20,
            ques.code_snippet || null,
            ques.image_url || null,
            idx
          ]
        );
      }
    }

    // Hydrate store.users from DB
    const usersRes = await client.query('SELECT * FROM users');
    for (const row of usersRes.rows) {
      store.users.set(row.id, {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        password: row.password,
        avatar: row.avatar
      });
    }

    // Hydrate store.quizzes + questions from DB
    const quizzesRes = await client.query('SELECT * FROM quizzes ORDER BY created_at DESC');
    const questionsRes = await client.query('SELECT * FROM questions ORDER BY order_index ASC');
    const questionsByQuiz = new Map<string, Question[]>();

    for (const row of questionsRes.rows) {
      const parsedOptions = typeof row.options === 'string'
        ? JSON.parse(row.options)
        : Array.isArray(row.options) ? row.options : [];
      const item: Question = {
        id: row.id,
        quiz_id: row.quiz_id,
        prompt: row.prompt,
        options: parsedOptions,
        correct_option_index: Number(row.correct_option_index),
        base_points: Number(row.base_points) || 1000,
        time_limit_seconds: Number(row.time_limit_seconds) || 20,
        code_snippet: row.code_snippet || undefined,
        image_url: row.image_url || undefined
      };
      const list = questionsByQuiz.get(row.quiz_id) || [];
      list.push(item);
      questionsByQuiz.set(row.quiz_id, list);
    }

    store.quizzes.clear();
    for (const row of quizzesRes.rows) {
      store.quizzes.set(row.id, {
        id: row.id,
        instructor_id: row.instructor_id,
        instructor_name: row.instructor_name || 'Instructor',
        title: row.title,
        description: row.description || '',
        is_published: !!row.is_published,
        questions: questionsByQuiz.get(row.id) || [],
        created_at: toIsoString(row.created_at),
        updated_at: toIsoString(row.updated_at)
      });
    }

    // Hydrate store.sessions + teams + members from DB
    const sessionsRes = await client.query('SELECT * FROM game_sessions');
    const teamsRes = await client.query('SELECT * FROM teams');
    const membersRes = await client.query('SELECT * FROM team_members');

    const membersByTeam = new Map<string, TeamMember[]>();
    for (const row of membersRes.rows) {
      const m: TeamMember = {
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name,
        team_id: row.team_id,
        individual_score: Number(row.individual_score) || 0,
        is_online: row.is_online !== false,
        avatar: row.avatar || 'U'
      };
      const list = membersByTeam.get(row.team_id) || [];
      list.push(m);
      membersByTeam.set(row.team_id, list);
    }

    const teamsBySession = new Map<string, Team[]>();
    for (const row of teamsRes.rows) {
      const t: Team = {
        id: row.id,
        session_id: row.session_id,
        name: row.name,
        color: row.color,
        badge: row.badge,
        total_score: Number(row.total_score) || 0,
        members: membersByTeam.get(row.id) || []
      };
      const list = teamsBySession.get(row.session_id) || [];
      list.push(t);
      teamsBySession.set(row.session_id, list);
    }

    for (const row of sessionsRes.rows) {
      const linkedQuiz = store.quizzes.get(row.quiz_id);
      const qIdx = Number(row.current_question_index);
      const session: GameSession = {
        id: row.id,
        quiz_id: row.quiz_id,
        quiz_title: row.quiz_title,
        room_code: row.room_code,
        status: (row.status || 'lobby') as SessionStatus,
        team_count: Number(row.team_count) || 2,
        teams: teamsBySession.get(row.room_code) || teamsBySession.get(row.id) || [],
        current_question_index: qIdx,
        total_questions: Number(row.total_questions) || (linkedQuiz?.questions.length || 0),
        host_user_id: row.host_user_id,
        created_at: toIsoString(row.created_at),
        current_question: linkedQuiz && qIdx >= 0 ? linkedQuiz.questions[qIdx] : undefined
      };
      store.sessions.set(row.room_code, session);
    }

    isDbConnected = true;
    client.release();
    console.log(
      `[DB] Hydrated ${store.users.size} users, ${store.quizzes.size} quizzes, and ${store.sessions.size} sessions from PostgreSQL.`
    );
    return true;
  } catch (err: any) {
    console.warn('[DB] Failed to connect to PostgreSQL. Falling back to in-memory mode:', err.message);
    return false;
  }
}

export async function dbSaveUser(user: User): Promise<void> {
  if (!isDbConnected) return;
  return enqueueWrite(`user:${user.id}`, async () => {
    await pool.query(
      `INSERT INTO users (id, name, email, role, password, avatar)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         password = EXCLUDED.password,
         avatar = EXCLUDED.avatar`,
      [user.id, user.name, user.email, user.role, user.password || 'password123', user.avatar || 'U']
    );
  });
}

export async function dbSaveQuiz(quiz: Quiz): Promise<void> {
  if (!isDbConnected) return;
  return enqueueWrite(`quiz:${quiz.id}`, async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO quizzes (id, instructor_id, instructor_name, title, description, is_published, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           is_published = EXCLUDED.is_published,
           updated_at = EXCLUDED.updated_at`,
        [
          quiz.id,
          quiz.instructor_id,
          quiz.instructor_name || 'Instructor',
          quiz.title,
          quiz.description || '',
          !!quiz.is_published,
          quiz.created_at || new Date().toISOString(),
          quiz.updated_at || new Date().toISOString()
        ]
      );

      await client.query('DELETE FROM questions WHERE quiz_id = $1', [quiz.id]);

      for (let idx = 0; idx < quiz.questions.length; idx++) {
        const ques = quiz.questions[idx];
        await client.query(
          `INSERT INTO questions (id, quiz_id, prompt, options, correct_option_index, base_points, time_limit_seconds, code_snippet, image_url, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             prompt = EXCLUDED.prompt,
             options = EXCLUDED.options,
             correct_option_index = EXCLUDED.correct_option_index,
             base_points = EXCLUDED.base_points,
             time_limit_seconds = EXCLUDED.time_limit_seconds,
             code_snippet = EXCLUDED.code_snippet,
             image_url = EXCLUDED.image_url,
             order_index = EXCLUDED.order_index`,
          [
            ques.id,
            quiz.id,
            ques.prompt,
            JSON.stringify(ques.options),
            ques.correct_option_index,
            ques.base_points || 1000,
            ques.time_limit_seconds || 20,
            ques.code_snippet || null,
            ques.image_url || null,
            idx
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}

export async function dbDeleteQuiz(quizId: string): Promise<void> {
  if (!isDbConnected) return;
  return enqueueWrite(`quiz:${quizId}`, async () => {
    await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
  });
}

export async function dbSaveSession(session: GameSession): Promise<void> {
  if (!isDbConnected) return;
  return enqueueWrite(`session:${session.room_code}`, async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO game_sessions (id, quiz_id, quiz_title, room_code, status, team_count, current_question_index, total_questions, host_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           team_count = EXCLUDED.team_count,
           current_question_index = EXCLUDED.current_question_index,
           total_questions = EXCLUDED.total_questions`,
        [
          session.id,
          session.quiz_id,
          session.quiz_title,
          session.room_code,
          session.status,
          session.team_count,
          session.current_question_index,
          session.total_questions,
          session.host_user_id || 'host-user',
          session.created_at || new Date().toISOString()
        ]
      );

      await client.query(
        'DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE session_id = $1)',
        [session.room_code]
      );
      await client.query('DELETE FROM teams WHERE session_id = $1', [session.room_code]);

      for (const team of session.teams) {
        await client.query(
          `INSERT INTO teams (id, session_id, name, color, badge, total_score)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             session_id = EXCLUDED.session_id,
             name = EXCLUDED.name,
             color = EXCLUDED.color,
             badge = EXCLUDED.badge,
             total_score = EXCLUDED.total_score`,
          [team.id, session.room_code, team.name, team.color, team.badge, team.total_score || 0]
        );

        for (const member of team.members) {
          await client.query(
            `INSERT INTO team_members (id, user_id, user_name, team_id, individual_score, is_online, avatar)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               team_id = EXCLUDED.team_id,
               individual_score = EXCLUDED.individual_score,
               is_online = EXCLUDED.is_online,
               avatar = EXCLUDED.avatar`,
            [
              member.id,
              member.user_id,
              member.user_name,
              team.id,
              member.individual_score || 0,
              member.is_online !== false,
              member.avatar || 'U'
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
