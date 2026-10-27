import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Quiz } from '@quizchaos/shared';

export const useQuizStore = defineStore('quiz', () => {
  const quizzes = ref<Quiz[]>([]);
  const currentQuiz = ref<Quiz | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchQuizzes(instructorId?: string) {
    loading.value = true;
    error.value = null;
    try {
      const url = instructorId ? `/api/quizzes?instructor_id=${instructorId}` : '/api/quizzes';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load quizzes');
      const data = await res.json();
      quizzes.value = data.quizzes;
    } catch (err: any) {
      error.value = err.message || 'Error fetching quizzes';
    } finally {
      loading.value = false;
    }
  }

  async function fetchQuizById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`/api/quizzes/${id}`);
      if (!res.ok) throw new Error('Quiz not found');
      const data = await res.json();
      currentQuiz.value = data.quiz;
      return data.quiz;
    } catch (err: any) {
      error.value = err.message || 'Error fetching quiz';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createQuiz(quizData: Partial<Quiz>) {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create quiz');
      quizzes.value.unshift(data.quiz);
      return data.quiz;
    } catch (err: any) {
      error.value = err.message || 'Error creating quiz';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateQuiz(id: string, quizData: Partial<Quiz>) {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`/api/quizzes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update quiz');
      const idx = quizzes.value.findIndex(q => q.id === id);
      if (idx !== -1) quizzes.value[idx] = data.quiz;
      currentQuiz.value = data.quiz;
      return data.quiz;
    } catch (err: any) {
      error.value = err.message || 'Error updating quiz';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function deleteQuiz(id: string) {
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete quiz');
      quizzes.value = quizzes.value.filter(q => q.id !== id);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Error deleting quiz';
      return false;
    }
  }

  async function togglePublish(id: string) {
    try {
      const res = await fetch(`/api/quizzes/${id}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle publish status');
      const data = await res.json();
      const idx = quizzes.value.findIndex(q => q.id === id);
      if (idx !== -1) quizzes.value[idx] = data.quiz;
      return data.quiz;
    } catch (err: any) {
      error.value = err.message || 'Error publishing quiz';
      return null;
    }
  }

  return {
    quizzes,
    currentQuiz,
    loading,
    error,
    fetchQuizzes,
    fetchQuizById,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    togglePublish
  };
});
