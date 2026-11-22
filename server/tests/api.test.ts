import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';

describe('NestJS REST API Integration', () => {
  let app: NestExpressApplication;
  let baseUrl = '';

  before(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    await app.listen(0);
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 3001;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  it('Auth register, duplicate check, and login flow works', async () => {
    const email = `test-${Date.now()}@university.edu`;

    // Missing password should fail
    const badReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email })
    });
    assert.equal(badReg.status, 400);

    // Valid registration
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Teacher',
        email,
        password: 'MyPassword123',
        role: 'teacher'
      })
    });
    assert.equal(reg.status, 201);
    const regData = await reg.json();
    assert.equal(regData.user.email, email);
    assert.equal(regData.user.role, 'teacher');

    // Duplicate email rejected
    const dup = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate',
        email,
        password: 'MyPassword123',
        role: 'student'
      })
    });
    assert.equal(dup.status, 409);

    // Wrong password rejected
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'WrongPassword' })
    });
    assert.equal(badLogin.status, 401);

    // Valid login
    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'MyPassword123' })
    });
    assert.equal(goodLogin.status, 200);
    const loginData = await goodLogin.json();
    assert.equal(loginData.user.name, 'Test Teacher');
  });

  it('Quiz CRUD supports True/False options, code_snippet, image_url, and publish toggle', async () => {
    const createRes = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Automated Test Quiz',
        description: 'Testing rich question fields',
        instructor_id: 'u-inst-1',
        instructor_name: 'Prof. Ada Lovelace',
        is_published: false,
        questions: [
          {
            prompt: 'Is TypeScript statically typed?',
            options: ['True', 'False'],
            correct_option_index: 0,
            base_points: 1000,
            time_limit_seconds: 15,
            code_snippet: 'const x: number = 42;',
            image_url: 'https://example.com/ts.png'
          }
        ]
      })
    });
    assert.equal(createRes.status, 201);
    const { quiz } = await createRes.json();
    assert.equal(quiz.title, 'Automated Test Quiz');
    assert.equal(quiz.questions[0].options.length, 2);
    assert.equal(quiz.questions[0].code_snippet, 'const x: number = 42;');
    assert.equal(quiz.questions[0].image_url, 'https://example.com/ts.png');

    // Toggle publish
    const pubRes = await fetch(`${baseUrl}/api/quizzes/${quiz.id}/publish`, { method: 'POST' });
    assert.equal(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.equal(pubData.quiz.is_published, true);

    // Delete quiz
    const delRes = await fetch(`${baseUrl}/api/quizzes/${quiz.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
  });

  it('Sessions create room, auto-balance players across teams, and return summary', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: 'quiz-cs-101',
        team_count: 4,
        host_user_id: 'u-inst-1'
      })
    });
    assert.equal(createRes.status, 201);
    const { session } = await createRes.json();
    assert.equal(session.teams.length, 4);

    for (let i = 1; i <= 4; i++) {
      const joinRes = await fetch(`${baseUrl}/api/sessions/${session.room_code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: `test-stu-${i}`,
          user_name: `Student ${i}`,
          avatar: `S${i}`
        })
      });
      assert.equal(joinRes.status, 200);
    }

    const summaryRes = await fetch(`${baseUrl}/api/sessions/${session.room_code}/summary`);
    assert.equal(summaryRes.status, 200);
    const summary = await summaryRes.json();
    assert.equal(summary.total_participants, 4);
    assert.ok(summary.teams.every((t: { members: unknown[] }) => t.members.length === 1));
  });
});
