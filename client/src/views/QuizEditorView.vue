<template>
  <div class="editor-page">
    <div class="editor-container">
      <div class="editor-header animate-pop">
        <div class="header-left">
          <router-link to="/instructor" class="btn-back">← Back to Dashboard</router-link>
          <h1>{{ isEditing ? 'Edit Quiz' : 'Create New Kahoot Quiz' }}</h1>
        </div>
        <div class="header-actions">
          <button
            @click="saveQuiz"
            :disabled="saving"
            class="btn-kahoot btn-primary btn-save"
          >
            <span v-if="saving">Saving Quiz...</span>
            <span v-else>💾 Save Quiz</span>
          </button>
        </div>
      </div>

      <!-- Error / Validation Alert -->
      <div v-if="validationError" class="error-banner animate-pop">
        ⚠️ {{ validationError }}
      </div>

      <!-- Quiz Details Card -->
      <div class="card-kahoot meta-card">
        <div class="form-row">
          <div class="form-group flex-2">
            <label>Quiz Title <span class="required">*</span></label>
            <input
              v-model="quizForm.title"
              type="text"
              placeholder="e.g. ⚡ Modern Web Development Challenge"
              class="input-kahoot input-title"
              required
            />
          </div>
          <div class="form-group flex-1">
            <label>Status</label>
            <label class="publish-checkbox">
              <input type="checkbox" v-model="quizForm.is_published" />
              <span class="publish-label">
                {{ quizForm.is_published ? '🟢 Published (Available to Host)' : '⚪ Draft (Hidden)' }}
              </span>
            </label>
          </div>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label>Description / Instructions</label>
          <textarea
            v-model="quizForm.description"
            rows="2"
            placeholder="Briefly describe what this quiz is about..."
            class="input-kahoot"
          ></textarea>
        </div>
      </div>

      <!-- Questions List -->
      <div class="questions-section">
        <div class="questions-header">
          <h2>Questions ({{ quizForm.questions.length }})</h2>
          <button @click="addQuestion" class="btn-kahoot btn-yellow btn-sm">
            + Add Question
          </button>
        </div>

        <div
          v-for="(q, qIndex) in quizForm.questions"
          :key="q.id || qIndex"
          class="card-kahoot question-card"
        >
          <div class="q-header">
            <div class="q-badge">Question {{ qIndex + 1 }}</div>
            <div class="q-settings">
              <div class="setting-item">
                <label>⏱️ Time Limit:</label>
                <select v-model.number="q.time_limit_seconds" class="select-kahoot">
                  <option :value="10">10s</option>
                  <option :value="15">15s</option>
                  <option :value="20">20s</option>
                  <option :value="30">30s</option>
                </select>
              </div>

              <div class="setting-item">
                <label>⭐ Points:</label>
                <select v-model.number="q.base_points" class="select-kahoot">
                  <option :value="500">500 pts</option>
                  <option :value="1000">1,000 pts</option>
                  <option :value="2000">2,000 pts</option>
                </select>
              </div>

              <button
                v-if="quizForm.questions.length > 1"
                @click="removeQuestion(qIndex)"
                class="btn-delete-q"
                title="Delete Question"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- Question Prompt -->
          <div class="form-group" style="margin: 16px 0;">
            <input
              v-model="q.prompt"
              type="text"
              placeholder="Enter your question here..."
              class="input-kahoot prompt-input"
              required
            />
          </div>

          <div class="options-guideline">
            <p>Select which option is correct (marked with a checkmark):</p>
          </div>

          <!-- 4 Kahoot Shape Options -->
          <div class="kahoot-options-grid">
            <!-- Option 1: Red Triangle -->
            <div class="option-field opt-red" :class="{ 'is-correct': q.correct_option_index === 0 }">
              <div class="opt-head">
                <span class="shape-icon">▲</span>
                <label class="correct-radio-label">
                  <input
                    type="radio"
                    :name="'correct-opt-' + qIndex"
                    :value="0"
                    v-model.number="q.correct_option_index"
                  />
                  <span>Correct Answer</span>
                </label>
              </div>
              <input
                v-model="q.options[0]"
                type="text"
                placeholder="Answer option 1..."
                class="opt-input"
              />
            </div>

            <!-- Option 2: Blue Diamond -->
            <div class="option-field opt-blue" :class="{ 'is-correct': q.correct_option_index === 1 }">
              <div class="opt-head">
                <span class="shape-icon">◆</span>
                <label class="correct-radio-label">
                  <input
                    type="radio"
                    :name="'correct-opt-' + qIndex"
                    :value="1"
                    v-model.number="q.correct_option_index"
                  />
                  <span>Correct Answer</span>
                </label>
              </div>
              <input
                v-model="q.options[1]"
                type="text"
                placeholder="Answer option 2..."
                class="opt-input"
              />
            </div>

            <!-- Option 3: Yellow Circle -->
            <div class="option-field opt-yellow" :class="{ 'is-correct': q.correct_option_index === 2 }">
              <div class="opt-head">
                <span class="shape-icon">●</span>
                <label class="correct-radio-label">
                  <input
                    type="radio"
                    :name="'correct-opt-' + qIndex"
                    :value="2"
                    v-model.number="q.correct_option_index"
                  />
                  <span>Correct Answer</span>
                </label>
              </div>
              <input
                v-model="q.options[2]"
                type="text"
                placeholder="Answer option 3 (optional)..."
                class="opt-input"
              />
            </div>

            <!-- Option 4: Green Square -->
            <div class="option-field opt-green" :class="{ 'is-correct': q.correct_option_index === 3 }">
              <div class="opt-head">
                <span class="shape-icon">■</span>
                <label class="correct-radio-label">
                  <input
                    type="radio"
                    :name="'correct-opt-' + qIndex"
                    :value="3"
                    v-model.number="q.correct_option_index"
                  />
                  <span>Correct Answer</span>
                </label>
              </div>
              <input
                v-model="q.options[3]"
                type="text"
                placeholder="Answer option 4 (optional)..."
                class="opt-input"
              />
            </div>
          </div>
        </div>

        <!-- Add Question Footer Button -->
        <div class="add-q-bottom">
          <button @click="addQuestion" class="btn-kahoot btn-white btn-block-custom">
            + Add Another Question
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useQuizStore } from '../stores/quiz';
import { Question } from '@quizchaos/shared';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const quizStore = useQuizStore();

const isEditing = ref(false);
const saving = ref(false);
const validationError = ref<string | null>(null);

const quizForm = ref({
  id: '',
  title: '',
  description: '',
  is_published: true,
  questions: [] as Question[]
});

onMounted(async () => {
  const quizId = route.params.id as string;
  if (quizId) {
    isEditing.value = true;
    const quiz = await quizStore.fetchQuizById(quizId);
    if (quiz) {
      quizForm.value = {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        is_published: quiz.is_published,
        questions: JSON.parse(JSON.stringify(quiz.questions))
      };
      // Ensure all questions have 4 slots
      quizForm.value.questions.forEach(q => {
        while (q.options.length < 4) {
          q.options.push('');
        }
      });
    }
  } else {
    // New quiz template with 1 initial question
    quizForm.value.questions.push(createEmptyQuestion());
  }
});

function createEmptyQuestion(): Question {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    prompt: '',
    options: ['', '', '', ''],
    correct_option_index: 0,
    base_points: 1000,
    time_limit_seconds: 20
  };
}

function addQuestion() {
  quizForm.value.questions.push(createEmptyQuestion());
}

function removeQuestion(index: number) {
  if (quizForm.value.questions.length > 1) {
    quizForm.value.questions.splice(index, 1);
  }
}

async function saveQuiz() {
  validationError.value = null;

  if (!quizForm.value.title.trim()) {
    validationError.value = 'Please provide a quiz title.';
    return;
  }

  if (quizForm.value.questions.length === 0) {
    validationError.value = 'Quiz must contain at least one question.';
    return;
  }

  // Story 1 validation
  for (let i = 0; i < quizForm.value.questions.length; i++) {
    const q = quizForm.value.questions[i];
    if (!q.prompt.trim()) {
      validationError.value = `Question ${i + 1} is missing a question prompt.`;
      return;
    }

    const validOptions = q.options.filter(opt => opt && opt.trim() !== '');
    if (validOptions.length < 2) {
      validationError.value = `Question ${i + 1} must have at least 2 filled answer options.`;
      return;
    }

    if (!q.options[q.correct_option_index] || !q.options[q.correct_option_index].trim()) {
      validationError.value = `Question ${i + 1} has marked an empty option as correct. Please select a valid answer.`;
      return;
    }
  }

  saving.value = true;

  try {
    const payload = {
      title: quizForm.value.title,
      description: quizForm.value.description,
      is_published: quizForm.value.is_published,
      instructor_id: authStore.user?.id || 'u-inst-1',
      instructor_name: authStore.user?.name || 'Instructor',
      questions: quizForm.value.questions.map(q => ({
        ...q,
        options: q.options.filter(opt => opt && opt.trim() !== '')
      }))
    };

    if (isEditing.value && quizForm.value.id) {
      await quizStore.updateQuiz(quizForm.value.id, payload);
    } else {
      await quizStore.createQuiz(payload);
    }

    router.push('/instructor');
  } catch (err: any) {
    validationError.value = err.message || 'Error saving quiz.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.editor-page {
  padding: 30px 20px 80px;
  flex: 1;
}

.editor-container {
  max-width: 960px;
  margin: 0 auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.btn-back {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 6px;
  display: inline-block;
}

.btn-back:hover {
  color: white;
}

.header-left h1 {
  font-size: 2rem;
  font-weight: 800;
  color: white;
}

.meta-card {
  margin-bottom: 30px;
}

.form-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.flex-2 {
  flex: 2;
  min-width: 280px;
}

.flex-1 {
  flex: 1;
  min-width: 200px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 700;
  font-size: 0.9rem;
  color: #444;
}

.required {
  color: #e21b3c;
}

.input-title {
  font-size: 1.15rem;
  font-weight: 700;
}

.publish-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #f9f9f9;
  border-radius: 8px;
  border: 2px solid #ddd;
  cursor: pointer;
}

.publish-checkbox input {
  width: 18px;
  height: 18px;
}

.publish-label {
  font-weight: 700;
  font-size: 0.9rem;
}

.questions-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.questions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.questions-header h2 {
  color: white;
  font-size: 1.5rem;
  font-weight: 800;
}

.question-card {
  border-left: 8px solid #ffa602;
}

.q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.q-badge {
  background: #ffa602;
  color: #222;
  font-weight: 800;
  font-size: 0.9rem;
  padding: 4px 12px;
  border-radius: 20px;
}

.q-settings {
  display: flex;
  align-items: center;
  gap: 14px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #555;
}

.select-kahoot {
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #ccc;
  outline: none;
}

.btn-delete-q {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.btn-delete-q:hover {
  background: #ffe3e6;
}

.prompt-input {
  font-size: 1.15rem;
  font-weight: 700;
  border-width: 2px;
}

.options-guideline {
  font-size: 0.85rem;
  font-weight: 700;
  color: #666;
  margin-bottom: 10px;
}

.kahoot-options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

@media (max-width: 640px) {
  .kahoot-options-grid {
    grid-template-columns: 1fr;
  }
}

.option-field {
  padding: 14px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.2);
  transition: transform 0.15s ease;
}

.opt-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shape-icon {
  font-size: 1.3rem;
  color: white;
}

.correct-radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: white;
  font-size: 0.85rem;
  font-weight: 800;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px 8px;
  border-radius: 14px;
}

.opt-input {
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  outline: none;
  background: white;
  color: #222;
}

.opt-red { background-color: var(--kahoot-red); }
.opt-blue { background-color: var(--kahoot-blue); }
.opt-yellow { background-color: var(--kahoot-yellow); }
.opt-yellow .shape-icon, .opt-yellow .correct-radio-label { color: #222; }
.opt-green { background-color: var(--kahoot-green); }

.option-field.is-correct {
  outline: 4px solid #ffffff;
  transform: scale(1.02);
}

.add-q-bottom {
  text-align: center;
  margin-top: 12px;
}

.btn-block-custom {
  width: 100%;
  padding: 14px;
  font-size: 1.1rem;
}

.error-banner {
  background: #ffe3e6;
  border: 2px solid #e21b3c;
  color: #e21b3c;
  padding: 12px 18px;
  border-radius: 8px;
  font-weight: 700;
  margin-bottom: 20px;
}
</style>
