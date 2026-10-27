<template>
  <div class="dashboard-page">
    <div class="dashboard-container">
      <!-- Top Banner -->
      <div class="dashboard-header animate-pop">
        <div class="header-titles">
          <div class="badge-role">Instructor Control Center</div>
          <h1>My Kahoot Quizzes</h1>
          <p>Create quizzes, launch collaborative live team battles, and track champions!</p>
        </div>
        <div class="header-actions">
          <router-link to="/instructor/quiz/new" class="btn-kahoot btn-primary">
            <span>+</span> Create New Quiz
          </router-link>
        </div>
      </div>

      <!-- Unauthorized Alert if not logged in as instructor -->
      <div v-if="!authStore.isInstructor" class="alert-box">
        <div class="alert-icon">⚠️</div>
        <div>
          <h3>Instructor Access Required</h3>
          <p>You are currently logged in as <strong>{{ authStore.user?.role || 'Guest' }}</strong>. Please switch to an instructor account to manage quizzes.</p>
          <router-link to="/login" class="btn-kahoot btn-yellow btn-sm" style="margin-top: 8px;">
            Switch to Instructor Account
          </router-link>
        </div>
      </div>

      <!-- Quizzes Grid -->
      <div v-if="quizStore.loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your quizzes...</p>
      </div>

      <div v-else-if="quizStore.quizzes.length === 0" class="empty-state card-kahoot">
        <span class="empty-icon">📝</span>
        <h2>No quizzes created yet</h2>
        <p>Start by creating your first team-based challenge or use our pre-seeded templates!</p>
        <router-link to="/instructor/quiz/new" class="btn-kahoot btn-primary" style="margin-top: 16px;">
          Create Your First Quiz
        </router-link>
      </div>

      <div v-else class="quiz-grid">
        <div
          v-for="quiz in quizStore.quizzes"
          :key="quiz.id"
          class="quiz-card card-kahoot"
        >
          <div class="card-top">
            <span
              class="status-pill"
              :class="quiz.is_published ? 'published' : 'draft'"
            >
              {{ quiz.is_published ? '● Published' : '○ Draft' }}
            </span>
            <span class="q-count">
              {{ quiz.questions.length }} {{ quiz.questions.length === 1 ? 'Question' : 'Questions' }}
            </span>
          </div>

          <h3 class="quiz-title">{{ quiz.title }}</h3>
          <p class="quiz-desc">{{ quiz.description || 'No description provided.' }}</p>

          <div class="quiz-meta">
            <span class="meta-item">⏱️ {{ quiz.questions.reduce((a, b) => a + (b.time_limit_seconds || 20), 0) }}s Total</span>
            <span class="meta-item">⭐ {{ quiz.questions.reduce((a, b) => a + (b.base_points || 1000), 0) }} Pts</span>
          </div>

          <!-- Action Buttons -->
          <div class="card-footer">
            <button
              @click="openLaunchModal(quiz)"
              class="btn-kahoot btn-primary btn-launch"
              title="Launch Live Session"
            >
              <span>🚀 Launch Game</span>
            </button>

            <div class="icon-actions">
              <router-link
                :to="`/instructor/quiz/${quiz.id}/edit`"
                class="btn-icon"
                title="Edit Quiz"
              >
                ✏️
              </router-link>
              <button
                @click="handleTogglePublish(quiz.id)"
                class="btn-icon"
                :title="quiz.is_published ? 'Unpublish' : 'Publish'"
              >
                {{ quiz.is_published ? '👁️' : '🔒' }}
              </button>
              <button
                @click="handleDelete(quiz.id)"
                class="btn-icon delete"
                title="Delete Quiz"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Launch Game Session Modal (Story 2) -->
      <div v-if="showLaunchModal && selectedQuiz" class="modal-overlay" @click.self="showLaunchModal = false">
        <div class="modal-content animate-pop">
          <div class="modal-header">
            <h2>🚀 Launch Live Quiz Session</h2>
            <button @click="showLaunchModal = false" class="btn-close">✕</button>
          </div>

          <div class="modal-body">
            <div class="selected-quiz-info">
              <h4>{{ selectedQuiz.title }}</h4>
              <p>{{ selectedQuiz.questions.length }} Questions ready for team battle</p>
            </div>

            <div class="form-group" style="margin-top: 18px;">
              <label class="modal-label">Select Number of Teams (2 to 4):</label>
              <p class="modal-sub">Students will be automatically divided in balanced order as they join!</p>
              
              <div class="team-count-selector">
                <button
                  v-for="count in [2, 3, 4]"
                  :key="count"
                  type="button"
                  :class="['btn-team-count', { selected: teamCount === count }]"
                  @click="teamCount = count"
                >
                  <span class="count-num">{{ count }}</span>
                  <span class="count-label">Teams</span>
                </button>
              </div>

              <!-- Team Preview -->
              <div class="teams-preview">
                <div
                  v-for="(team, idx) in previewTeams"
                  :key="idx"
                  class="preview-pill"
                  :style="{ borderColor: team.color, color: team.color }"
                >
                  <span>{{ team.badge }}</span>
                  <strong>{{ team.name }}</strong>
                </div>
              </div>
            </div>

            <div v-if="launchError" class="error-banner">
              ⚠️ {{ launchError }}
            </div>
          </div>

          <div class="modal-footer">
            <button @click="showLaunchModal = false" class="btn-kahoot btn-secondary">
              Cancel
            </button>
            <button
              @click="confirmLaunchSession"
              :disabled="launching"
              class="btn-kahoot btn-primary"
            >
              <span v-if="launching">Generating Room PIN...</span>
              <span v-else>Start Live Lobby ⚡</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useQuizStore } from '../stores/quiz';
import { Quiz } from '@quizchaos/shared';

const authStore = useAuthStore();
const quizStore = useQuizStore();
const router = useRouter();

const showLaunchModal = ref(false);
const selectedQuiz = ref<Quiz | null>(null);
const teamCount = ref(2);
const launching = ref(false);
const launchError = ref<string | null>(null);

const TEAM_NAMES = [
  { name: 'Red Rockets', color: '#e21b3c', badge: '🚀' },
  { name: 'Blue Blasters', color: '#1368ce', badge: '⚡' },
  { name: 'Golden Geeks', color: '#ffa602', badge: '⭐' },
  { name: 'Green Giants', color: '#26890c', badge: '🦖' }
];

const previewTeams = computed(() => TEAM_NAMES.slice(0, teamCount.value));

onMounted(() => {
  quizStore.fetchQuizzes(authStore.user?.id);
});

function openLaunchModal(quiz: Quiz) {
  selectedQuiz.value = quiz;
  teamCount.value = 2;
  launchError.value = null;
  showLaunchModal.value = true;
}

async function handleTogglePublish(quizId: string) {
  await quizStore.togglePublish(quizId);
}

async function handleDelete(quizId: string) {
  if (confirm('Are you sure you want to delete this quiz?')) {
    await quizStore.deleteQuiz(quizId);
  }
}

async function confirmLaunchSession() {
  if (!selectedQuiz.value) return;
  launching.value = true;
  launchError.value = null;

  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: selectedQuiz.value.id,
        team_count: teamCount.value,
        host_user_id: authStore.user?.id || 'host-user'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to launch session');
    }

    showLaunchModal.value = false;
    router.push(`/instructor/session/${data.session.room_code}`);
  } catch (err: any) {
    launchError.value = err.message || 'Error creating game session';
  } finally {
    launching.value = false;
  }
}
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px 60px;
  flex: 1;
}

.dashboard-container {
  max-width: 1100px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 30px;
}

.badge-role {
  display: inline-block;
  background: rgba(255, 166, 2, 0.25);
  color: #ffa602;
  border: 1px solid #ffa602;
  font-weight: 800;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.header-titles h1 {
  font-size: 2.2rem;
  font-weight: 800;
  color: white;
}

.header-titles p {
  color: rgba(255, 255, 255, 0.75);
  font-size: 1rem;
  margin-top: 4px;
}

.alert-box {
  background: #fff8e6;
  border: 2px solid #ffa602;
  color: #593e00;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.alert-icon {
  font-size: 1.8rem;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  color: #333;
}

.empty-icon {
  font-size: 3.5rem;
  display: block;
  margin-bottom: 12px;
}

.quiz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.quiz-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-top: 6px solid #46178f;
}

.quiz-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.2);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-pill {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 12px;
}

.status-pill.published {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-pill.draft {
  background: #f5f5f5;
  color: #757575;
}

.q-count {
  font-size: 0.85rem;
  font-weight: 700;
  color: #666;
}

.quiz-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #222;
  margin-bottom: 8px;
  line-height: 1.3;
}

.quiz-desc {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 16px;
  line-height: 1.4;
  flex: 1;
}

.quiz-meta {
  display: flex;
  gap: 14px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #555;
  background: #f9f9f9;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid #eee;
  padding-top: 14px;
}

.btn-launch {
  flex: 1;
  font-size: 0.95rem;
  padding: 10px 14px;
}

.icon-actions {
  display: flex;
  gap: 6px;
}

.btn-icon {
  background: #f0f0f0;
  border: none;
  font-size: 1.1rem;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}

.btn-icon:hover {
  background: #e0e0e0;
}

.btn-icon.delete:hover {
  background: #ffebee;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 200;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  padding: 24px;
  color: #333;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h2 {
  font-size: 1.4rem;
  font-weight: 800;
  color: #46178f;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  color: #888;
}

.selected-quiz-info {
  background: #f5f0ff;
  border: 1px solid #d4c0f8;
  border-radius: 8px;
  padding: 12px;
}

.selected-quiz-info h4 {
  font-weight: 800;
  color: #46178f;
}

.selected-quiz-info p {
  font-size: 0.85rem;
  color: #555;
  margin-top: 2px;
}

.modal-label {
  font-weight: 800;
  font-size: 1rem;
  display: block;
}

.modal-sub {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 12px;
}

.team-count-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.btn-team-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-team-count.selected {
  border-color: #26890c;
  background: #edf7ee;
}

.count-num {
  font-size: 1.8rem;
  font-weight: 800;
  color: #26890c;
}

.count-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #555;
}

.teams-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-pill {
  border: 2px solid;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fafafa;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.error-banner {
  background: #ffe3e6;
  border: 1px solid #e21b3c;
  color: #e21b3c;
  padding: 10px;
  border-radius: 6px;
  margin-top: 12px;
  font-weight: 600;
}
</style>
