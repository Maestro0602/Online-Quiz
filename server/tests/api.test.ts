import 'reflect-metadata';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { verifyJwt } from '../src/utils/jwt.js';

describe('NestJS REST API Integration & JWT Role Guards', () => {
  let app: NestExpressApplication;
  let baseUrl = '';
  let instructorToken = '';
  let hostToken = '';
  let studentToken = '';

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

  it('Auth register, secret host code, demo-login, and JWT signing work', async () => {
    const ts = Date.now();
    const teacherEmail = `teacher-${ts}@university.edu`;
    const hostEmail = `casualhost-${ts}@gmail.com`;
    const studentEmail = `student-${ts}@university.edu`;

    // Missing password should fail
    const badReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: teacherEmail })
    });
    assert.equal(badReg.status, 400);

    // Register teacher -> signed JWT
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Teacher',
        email: teacherEmail,
        password: 'MyPassword123',
        role: 'teacher'
      })
    });
    assert.equal(reg.status, 201);
    const regData = await reg.json();
    assert.equal(regData.user.role, 'teacher');
    assert.ok(regData.token.split('.').length === 3);
    const verified = verifyJwt(regData.token);
    assert.equal(verified?.role, 'teacher');
    instructorToken = regData.token;

    // Duplicate email rejected
    const dup = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate',
        email: teacherEmail,
        password: 'MyPassword123',
        role: 'student'
      })
    });
    assert.equal(dup.status, 409);

    // Register secret host role using QUIZHOST invite code
    const hostReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Trivia Night Host',
        email: hostEmail,
        password: 'HostPassword123',
        role: 'user',
        host_code: 'QUIZHOST'
      })
    });
    assert.equal(hostReg.status, 201);
    const hostData = await hostReg.json();
    assert.equal(hostData.user.role, 'host');
    hostToken = hostData.token;

    // Register normal student
    const stuReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Normal Student',
        email: studentEmail,
        password: 'StuPassword123',
        role: 'student'
      })
    });
    assert.equal(stuReg.status, 201);
    const stuData = await stuReg.json();
    studentToken = stuData.token;

    // Wrong password rejected
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: teacherEmail, password: 'WrongPassword' })
    });
    assert.equal(badLogin.status, 401);

    // Valid login returns signed JWT
    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: teacherEmail, password: 'MyPassword123' })
    });
    assert.equal(goodLogin.status, 200);
    const loginData = await goodLogin.json();
    assert.ok(verifyJwt(loginData.token)?.sub === regData.user.id);

    // Demo login returns signed JWT
    const demoRes = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'u-inst-1' })
    });
    assert.equal(demoRes.status, 200);
    const demoData = await demoRes.json();
    assert.equal(verifyJwt(demoData.token)?.role, 'instructor');
  });

  it('JWT Role Guards enforce 401 (no/bad token) and 403 (student/host on quiz writes)', async () => {
    const sampleQuiz = {
      title: 'Guarded Quiz',
      description: 'Testing guards',
      instructor_id: 'u-inst-1',
      questions: [
        {
          prompt: '2 + 2 = ?',
          options: ['4', '5'],
          correct_option_index: 0
        }
      ]
    };

    // No token -> 401
    const noToken = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleQuiz)
    });
    assert.equal(noToken.status, 401);

    // Tampered token -> 401
    const tampered = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}tampered`
      },
      body: JSON.stringify(sampleQuiz)
    });
    assert.equal(tampered.status, 401);

    // Student token -> 403 on quiz creation AND 403 on session launch
    const stuQuiz = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify(sampleQuiz)
    });
    assert.equal(stuQuiz.status, 403);

    const stuSession = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ quiz_id: 'quiz-cs-101', team_count: 2 })
    });
    assert.equal(stuSession.status, 403);

    // Secret host token -> 403 on quiz creation, 201 on session launch!
    const hostQuiz = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`
      },
      body: JSON.stringify(sampleQuiz)
    });
    assert.equal(hostQuiz.status, 403);

    const hostSession = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`
      },
      body: JSON.stringify({ quiz_id: 'quiz-cs-101', team_count: 2 })
    });
    assert.equal(hostSession.status, 201);
  });

  it('Quiz CRUD supports True/False options, code_snippet, image_url, and publish toggle with instructor JWT', async () => {
    const createRes = await fetch(`${baseUrl}/api/quizzes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`
      },
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
    const pubRes = await fetch(`${baseUrl}/api/quizzes/${quiz.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    assert.equal(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.equal(pubData.quiz.is_published, true);

    // Delete quiz
    const delRes = await fetch(`${baseUrl}/api/quizzes/${quiz.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${instructorToken}` }
    });
    assert.equal(delRes.status, 200);
  });

  it('Sessions create room, auto-balance players across teams, and return summary', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`
      },
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
