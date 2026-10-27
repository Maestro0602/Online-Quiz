import { Router, Request, Response } from 'express';
import { store } from '../data/store.js';
import { Quiz, Question } from '@quizchaos/shared';

const router = Router();

// GET /api/quizzes - list quizzes
router.get('/', (req: Request, res: Response) => {
  const instructorId = req.query.instructor_id as string | undefined;
  let quizzes = Array.from(store.quizzes.values());

  if (instructorId) {
    quizzes = quizzes.filter(q => q.instructor_id === instructorId);
  }

  res.json({ quizzes });
});

// GET /api/quizzes/:id - get single quiz
router.get('/:id', (req: Request, res: Response) => {
  const quiz = store.quizzes.get(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  res.json({ quiz });
});

// POST /api/quizzes - create quiz
router.post('/', (req: Request, res: Response) => {
  const { title, description, instructor_id, instructor_name, is_published, questions } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Quiz title is required' });
  }

  if (!instructor_id) {
    return res.status(401).json({ error: 'Instructor authentication required' });
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'At least one question is required' });
  }

  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.prompt || !q.prompt.trim()) {
      return res.status(400).json({ error: `Question #${i + 1} must have a prompt` });
    }
    const validOptions = (q.options || []).filter((opt: string) => opt && opt.trim() !== '');
    if (validOptions.length < 2) {
      return res.status(400).json({ error: `Question #${i + 1} must have at least 2 non-empty options` });
    }
    if (typeof q.correct_option_index !== 'number' || q.correct_option_index < 0 || q.correct_option_index >= validOptions.length) {
      return res.status(400).json({ error: `Question #${i + 1} must have a valid correct option selected` });
    }
  }

  const quizId = `quiz-${Date.now()}`;
  const formattedQuestions: Question[] = questions.map((q: any, idx: number) => ({
    id: q.id || `q-${quizId}-${idx + 1}`,
    quiz_id: quizId,
    prompt: q.prompt.trim(),
    options: q.options.map((opt: string) => opt.trim()),
    correct_option_index: Number(q.correct_option_index),
    base_points: Number(q.base_points) || 1000,
    time_limit_seconds: Number(q.time_limit_seconds) || 20
  }));

  const newQuiz: Quiz = {
    id: quizId,
    instructor_id,
    instructor_name: instructor_name || 'Instructor',
    title: title.trim(),
    description: (description || '').trim(),
    is_published: !!is_published,
    questions: formattedQuestions,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.quizzes.set(quizId, newQuiz);
  res.status(201).json({ quiz: newQuiz });
});

// PUT /api/quizzes/:id - update quiz
router.put('/:id', (req: Request, res: Response) => {
  const quizId = req.params.id;
  const existing = store.quizzes.get(quizId);

  if (!existing) {
    return res.status(404).json({ error: 'Quiz not found' });
  }

  const { title, description, is_published, questions } = req.body;

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'Quiz title cannot be empty' });
  }

  if (questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required' });
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt || !q.prompt.trim()) {
        return res.status(400).json({ error: `Question #${i + 1} must have a prompt` });
      }
      const validOptions = (q.options || []).filter((opt: string) => opt && opt.trim() !== '');
      if (validOptions.length < 2) {
        return res.status(400).json({ error: `Question #${i + 1} must have at least 2 non-empty options` });
      }
      if (typeof q.correct_option_index !== 'number' || q.correct_option_index < 0 || q.correct_option_index >= validOptions.length) {
        return res.status(400).json({ error: `Question #${i + 1} must have a valid correct option selected` });
      }
    }
  }

  const updatedQuestions = questions
    ? questions.map((q: any, idx: number) => ({
        id: q.id || `q-${quizId}-${idx + 1}`,
        quiz_id: quizId,
        prompt: q.prompt.trim(),
        options: q.options.map((opt: string) => opt.trim()),
        correct_option_index: Number(q.correct_option_index),
        base_points: Number(q.base_points) || 1000,
        time_limit_seconds: Number(q.time_limit_seconds) || 20
      }))
    : existing.questions;

  const updatedQuiz: Quiz = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    description: description !== undefined ? description.trim() : existing.description,
    is_published: is_published !== undefined ? !!is_published : existing.is_published,
    questions: updatedQuestions,
    updated_at: new Date().toISOString()
  };

  store.quizzes.set(quizId, updatedQuiz);
  res.json({ quiz: updatedQuiz });
});

// DELETE /api/quizzes/:id - delete quiz
router.delete('/:id', (req: Request, res: Response) => {
  const quizId = req.params.id;
  if (!store.quizzes.has(quizId)) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  store.quizzes.delete(quizId);
  res.json({ success: true, message: 'Quiz deleted' });
});

// POST /api/quizzes/:id/publish - toggle publish
router.post('/:id/publish', (req: Request, res: Response) => {
  const quiz = store.quizzes.get(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  quiz.is_published = !quiz.is_published;
  quiz.updated_at = new Date().toISOString();
  res.json({ quiz });
});

export default router;
