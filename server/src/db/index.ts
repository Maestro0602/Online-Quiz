import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const hasDbUrl = !!process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined
});

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
        time_limit_seconds INT DEFAULT 20
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
    `);

    client.release();
    console.log('[DB] Database tables verified / initialized successfully.');
    return true;
  } catch (err: any) {
    console.warn('[DB] Failed to connect to PostgreSQL. Falling back to in-memory mode:', err.message);
    return false;
  }
}
