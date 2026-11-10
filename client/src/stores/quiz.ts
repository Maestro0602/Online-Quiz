import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Quiz } from '@quizchaos/shared';
import { quizMockService, resetMockDbToSeed, triggerSimulatedApiError } from '../services/mockApi';

export const useQuizStore = defineStore('quiz', () => {
  const quizzes = ref<Quiz[]>([]);
  const currentQuiz = ref<Quiz | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchQuizzes(instructorId?: string) {
    loading.value = true;
    error.value = null;
    try {
      quizzes.value = await quizMockService.getQuizzes(instructorId);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error fetching quizzes from mock API';
    } finally {
      loading.value = false;
    }
  }

  async function fetchQuizById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const quiz = await quizMockService.getQuizById(id);
      currentQuiz.value = quiz;
      return quiz;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error fetching quiz';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createQuiz(quizData: Partial<Quiz>) {
    loading.value = true;
    error.value = null;
    try {
      const created = await quizMockService.createQuiz(quizData);
      quizzes.value.unshift(created);
      return created;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error creating quiz';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateQuiz(id: string, quizData: Partial<Quiz>) {
    loading.value = true;
    error.value = null;
    try {
      const updated = await quizMockService.updateQuiz(id, quizData);
      const idx = quizzes.value.findIndex(q => q.id === id);
      if (idx !== -1) quizzes.value[idx] = updated;
      currentQuiz.value = updated;
      return updated;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error updating quiz';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function deleteQuiz(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await quizMockService.deleteQuiz(id);
      quizzes.value = quizzes.value.filter(q => q.id !== id);
      return true;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error deleting quiz';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function togglePublish(id: string) {
    try {
      const updated = await quizMockService.togglePublish(id);
      const idx = quizzes.value.findIndex(q => q.id === id);
      if (idx !== -1) quizzes.value[idx] = updated;
      return updated;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error publishing quiz';
      return null;
    }
  }

  // M1 Prototype State Demonstration Helpers (Loading / Empty / Error / Reset)
  function simulateLoadingState() {
    error.value = null;
    loading.value = true;
    setTimeout(() => {
      loading.value = false;
    }, 2500);
  }

  function simulateEmptyState() {
    loading.value = false;
    error.value = null;
    quizzes.value = [];
  }

  async function simulateErrorState() {
    triggerSimulatedApiError('Mock API Error 503: Failed to fetch quiz catalog from local JSON service.');
    await fetchQuizzes();
  }

  async function resetToSeedData(instructorId?: string) {
    resetMockDbToSeed();
    await fetchQuizzes(instructorId);
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
    togglePublish,
    simulateLoadingState,
    simulateEmptyState,
    simulateErrorState,
    resetToSeedData
  };
});
