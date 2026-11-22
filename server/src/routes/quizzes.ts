import { Controller, Get, Post, Put, Delete, Param, Query, Body, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { store } from '../data/store.js';
import { dbSaveQuiz, dbDeleteQuiz } from '../db/index.js';
import { CreatorAuthGuard } from '../guards/auth.guard.js';
import { Quiz, Question } from '@quizchaos/shared';

@Controller('api/quizzes')
export class QuizzesController {
  @Get()
  listQuizzes(@Query('instructor_id') instructorId?: string) {
    let quizzes = Array.from(store.quizzes.values());
    if (instructorId) {
      quizzes = quizzes.filter(q => q.instructor_id === instructorId);
    }
    return { quizzes };
  }

  @Get(':id')
  getQuiz(@Param('id') id: string, @Res() res: Response) {
    const quiz = store.quizzes.get(id);
    if (!quiz) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Quiz not found' });
    }
    return res.status(HttpStatus.OK).json({ quiz });
  }

  @Post()
  @UseGuards(CreatorAuthGuard)
  createQuiz(@Body() body: any, @Res() res: Response) {
    const { title, description, instructor_id, instructor_name, is_published, questions } = body;

    if (!title || !title.trim()) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Quiz title is required' });
    }

    if (!instructor_id) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Instructor authentication required' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'At least one question is required' });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt || !q.prompt.trim()) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: `Question #${i + 1} must have a prompt` });
      }
      const validOptions = (q.options || []).filter((opt: string) => opt && opt.trim() !== '');
      if (validOptions.length < 2) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: `Question #${i + 1} must have at least 2 non-empty options` });
      }
      if (typeof q.correct_option_index !== 'number' || q.correct_option_index < 0 || q.correct_option_index >= validOptions.length) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: `Question #${i + 1} must have a valid correct option selected` });
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
      time_limit_seconds: Number(q.time_limit_seconds) || 20,
      code_snippet: q.code_snippet && String(q.code_snippet).trim() ? String(q.code_snippet).trim() : undefined,
      image_url: q.image_url && String(q.image_url).trim() ? String(q.image_url).trim() : undefined
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
    void dbSaveQuiz(newQuiz);
    return res.status(HttpStatus.CREATED).json({ quiz: newQuiz });
  }

  @Put(':id')
  @UseGuards(CreatorAuthGuard)
  updateQuiz(@Param('id') quizId: string, @Body() body: any, @Res() res: Response) {
    const existing = store.quizzes.get(quizId);

    if (!existing) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Quiz not found' });
    }

    const { title, description, is_published, questions } = body;

    if (title !== undefined && !title.trim()) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Quiz title cannot be empty' });
    }

    if (questions) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'At least one question is required' });
      }
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.prompt || !q.prompt.trim()) {
          return res.status(HttpStatus.BAD_REQUEST).json({ error: `Question #${i + 1} must have a prompt` });
        }
        const validOptions = (q.options || []).filter((opt: string) => opt && opt.trim() !== '');
        if (validOptions.length < 2) {
          return res.status(HttpStatus.BAD_REQUEST).json({ error: `Question #${i + 1} must have at least 2 non-empty options` });
        }
        if (typeof q.correct_option_index !== 'number' || q.correct_option_index < 0 || q.correct_option_index >= validOptions.length) {
          return res.status(HttpStatus.BAD_REQUEST).json({ error: `Question #${i + 1} must have a valid correct option selected` });
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
          time_limit_seconds: Number(q.time_limit_seconds) || 20,
          code_snippet: q.code_snippet && String(q.code_snippet).trim() ? String(q.code_snippet).trim() : undefined,
          image_url: q.image_url && String(q.image_url).trim() ? String(q.image_url).trim() : undefined
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
    void dbSaveQuiz(updatedQuiz);
    return res.status(HttpStatus.OK).json({ quiz: updatedQuiz });
  }

  @Delete(':id')
  @UseGuards(CreatorAuthGuard)
  deleteQuiz(@Param('id') quizId: string, @Res() res: Response) {
    if (!store.quizzes.has(quizId)) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Quiz not found' });
    }
    store.quizzes.delete(quizId);
    void dbDeleteQuiz(quizId);
    return res.status(HttpStatus.OK).json({ success: true, message: 'Quiz deleted' });
  }

  @Post(':id/publish')
  @UseGuards(CreatorAuthGuard)
  togglePublish(@Param('id') quizId: string, @Res() res: Response) {
    const quiz = store.quizzes.get(quizId);
    if (!quiz) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Quiz not found' });
    }
    quiz.is_published = !quiz.is_published;
    quiz.updated_at = new Date().toISOString();
    void dbSaveQuiz(quiz);
    return res.status(HttpStatus.OK).json({ quiz });
  }
}
