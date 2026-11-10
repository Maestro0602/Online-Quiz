<template>
  <div class="student-view" :style="{ '--team-theme-color': gameStore.myTeam?.color || '#46178f' }">
    <!-- Student & Team Header Bar -->
    <header class="student-header">
      <div class="team-banner" v-if="gameStore.myTeam">
        <span class="team-badge">[{{ gameStore.myTeam.badge }}]</span>
        <div class="team-meta">
          <span class="team-label">YOUR TEAM</span>
          <strong class="team-name" :style="{ color: gameStore.myTeam.color }">
            {{ gameStore.myTeam.name }}
          </strong>
        </div>
      </div>

      <div class="score-pills">
        <div class="score-chip team-score-chip" v-if="gameStore.myTeam">
          <span class="chip-label">Team Score</span>
          <span class="chip-val">{{ gameStore.myTeam.total_score.toLocaleString() }}</span>
        </div>
        <div class="score-chip my-score-chip" v-if="gameStore.myMember">
          <span class="chip-label">My Score</span>
          <span class="chip-val">{{ gameStore.myMember.individual_score.toLocaleString() }}</span>
        </div>
      </div>
    </header>

    <!-- STAGE 1: LOBBY -->
    <section v-if="gameStore.isInLobby" class="student-lobby-stage animate-pop">
      <div class="lobby-card card-kahoot">
        <div class="welcome-header">
          <h2>Welcome, {{ gameStore.myMember?.user_name }}</h2>
          <p class="subtitle">You have been automatically assigned to:</p>
        </div>

        <div
          v-if="gameStore.myTeam"
          class="team-showcase"
          :style="{ borderColor: gameStore.myTeam.color, background: getTeamLightBg(gameStore.myTeam.color) }"
        >
          <span class="team-giant-badge">[{{ gameStore.myTeam.badge }}]</span>
          <h1 :style="{ color: gameStore.myTeam.color }">{{ gameStore.myTeam.name }}</h1>
          <p>Collaborate with your teammates to climb the podium</p>
        </div>

        <div class="teammates-box" v-if="gameStore.myTeam">
          <h4>Your Teammates ({{ gameStore.myTeam.members.length }}):</h4>
          <div class="teammates-pills">
            <span
              v-for="m in gameStore.myTeam.members"
              :key="m.id"
              class="teammate-tag"
            >
              [{{ m.avatar || m.user_name.substring(0, 2).toUpperCase() }}] {{ m.user_name }}
            </span>
          </div>
        </div>

        <div class="waiting-prompt animate-pulse-slow">
          Waiting for instructor to start the quiz...
        </div>
      </div>
    </section>

    <!-- STAGE 2: QUESTION ACTIVE -->
    <section v-else-if="gameStore.isQuestionActive" class="student-gameplay-stage">
      <!-- Question Info & Countdown -->
      <div class="q-bar">
        <span class="q-num">
          Q{{ (gameStore.session?.current_question_index || 0) + 1 }} / {{ gameStore.session?.total_questions }}
        </span>
        <div class="timer-badge" :class="{ 'timer-low': gameStore.timeRemaining <= 5 }">
          Time: {{ gameStore.timeRemaining }}s
        </div>
      </div>

      <!-- Question Prompt -->
      <div class="question-box card-kahoot animate-pop">
        <h3>{{ currentQuestion?.prompt }}</h3>
      </div>

      <!-- If student has answered, show waiting screen -->
      <div v-if="hasAnswered" class="locked-in-box card-kahoot animate-pop">
        <div class="locked-tag">SUBMITTED</div>
        <h2>Answer Locked In</h2>
        <p>Waiting for teammates and timer to reveal the result...</p>
        <div class="selected-summary" :class="getShapeClass(gameStore.selectedAnswerIndex!)">
          <span class="shape-symbol">{{ getShapeSymbol(gameStore.selectedAnswerIndex!) }}</span>
          <span>{{ currentQuestion?.options[gameStore.selectedAnswerIndex!] }}</span>
        </div>
      </div>

      <!-- 4 Kahoot Shape Touch Answer Buttons -->
      <div v-else class="kahoot-buttons-grid">
        <button
          @click="selectOption(0)"
          class="kahoot-btn answer-red animate-pop"
        >
          <span class="shape-icon">▲</span>
          <span class="btn-text">{{ currentQuestion?.options[0] }}</span>
        </button>

        <button
          @click="selectOption(1)"
          class="kahoot-btn answer-blue animate-pop"
        >
          <span class="shape-icon">◆</span>
          <span class="btn-text">{{ currentQuestion?.options[1] }}</span>
        </button>

        <button
          @click="selectOption(2)"
          class="kahoot-btn answer-yellow animate-pop"
        >
          <span class="shape-icon">●</span>
          <span class="btn-text">{{ currentQuestion?.options[2] }}</span>
        </button>

        <button
          @click="selectOption(3)"
          class="kahoot-btn answer-green animate-pop"
        >
          <span class="shape-icon">■</span>
          <span class="btn-text">{{ currentQuestion?.options[3] }}</span>
        </button>
      </div>
    </section>

    <!-- STAGE 3: QUESTION RESULT -->
    <section v-else-if="gameStore.isQuestionResult" class="student-result-stage animate-pop">
      <div
        class="result-card card-kahoot"
        :class="gameStore.answerResult?.is_correct ? 'result-correct' : 'result-incorrect'"
      >
        <div class="result-banner">
          <h2>
            {{ gameStore.answerResult?.is_correct ? 'CORRECT' : 'INCORRECT' }}
          </h2>
          <div v-if="gameStore.answerResult?.is_correct" class="points-badge">
            +{{ gameStore.answerResult?.points_awarded }} Points for your team
          </div>
          <div v-else class="sub-msg">
            Keep pushing with your team for the next question
          </div>
        </div>

        <div class="team-contribution-box">
          <div class="contrib-row">
            <span>[{{ gameStore.myTeam?.badge }}] {{ gameStore.myTeam?.name }} Total:</span>
            <strong>{{ gameStore.myTeam?.total_score.toLocaleString() }} pts</strong>
          </div>
          <div class="contrib-row">
            <span>Your Individual Total:</span>
            <strong>{{ gameStore.myMember?.individual_score.toLocaleString() }} pts</strong>
          </div>
        </div>

        <div class="waiting-next-prompt animate-pulse-slow">
          Instructor is advancing to the next round...
        </div>
      </div>
    </section>

    <!-- STAGE 4: ENDED -->
    <section v-else-if="gameStore.isEnded" class="student-ended-stage animate-pop">
      <div class="game-over-card card-kahoot">
        <h2>Quiz Completed</h2>
        <p>Great teamwork in this battle</p>

        <div class="final-rank-box" v-if="teamRank">
          <span class="rank-title">Your Team Finished:</span>
          <div class="rank-number" :class="'place-' + teamRank">
            #{{ teamRank }} Place
          </div>
          <div class="final-team-score">
            {{ gameStore.myTeam?.total_score.toLocaleString() }} Team Points
          </div>
        </div>

        <router-link
          :to="`/summary/${roomCode}`"
          class="btn-kahoot btn-primary btn-summary-link"
        >
          View Full Leaderboard & MVPs →
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useGameStore } from '../stores/game';

const route = useRoute();
const authStore = useAuthStore();
const gameStore = useGameStore();

const roomCode = computed(() => route.params.roomCode as string);
const currentQuestion = computed(() => gameStore.session?.current_question);

const hasAnswered = computed(() => gameStore.selectedAnswerIndex !== null);

const teamRank = computed(() => {
  if (!gameStore.myTeam || !gameStore.rankedTeams) return null;
  const idx = gameStore.rankedTeams.findIndex((t: any) => t.id === gameStore.myTeam?.id);
  return idx !== -1 ? idx + 1 : null;
});

onMounted(async () => {
  // Check local session storage for rejoined state
  const savedTeam = sessionStorage.getItem(`session_${roomCode.value}_team`);
  const savedMember = sessionStorage.getItem(`session_${roomCode.value}_member`);
  if (savedTeam) {
    try { gameStore.myTeam = JSON.parse(savedTeam); } catch {}
  }
  if (savedMember) {
    try { gameStore.myMember = JSON.parse(savedMember); } catch {}
  }

  const userId = authStore.user?.id || gameStore.myMember?.user_id || 'stud-1';
  await gameStore.initSocket(roomCode.value, userId, 'student');
});

function selectOption(index: number) {
  if (hasAnswered.value || !currentQuestion.value) return;
  const userId = authStore.user?.id || gameStore.myMember?.user_id || 'guest-user';
  gameStore.submitAnswer(roomCode.value, userId, currentQuestion.value.id, index);
}

function getShapeSymbol(idx: number) {
  return ['▲', '◆', '●', '■'][idx] || '';
}

function getShapeClass(idx: number) {
  return ['answer-red', 'answer-blue', 'answer-yellow', 'answer-green'][idx] || '';
}

function getTeamLightBg(color: string) {
  return `${color}15`;
}
</script>

<style scoped>
.student-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.student-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  padding: 10px 18px;
  border-radius: 14px;
  margin-bottom: 20px;
}

.team-banner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.team-badge {
  font-size: 1.8rem;
}

.team-meta {
  display: flex;
  flex-direction: column;
}

.team-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 800;
  letter-spacing: 0.5px;
}

.team-name {
  font-size: 1.15rem;
  font-weight: 900;
}

.score-pills {
  display: flex;
  gap: 10px;
}

.score-chip {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 6px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chip-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
}

.chip-val {
  font-size: 1rem;
  font-weight: 800;
  color: #ffa602;
}

/* LOBBY */
.lobby-card {
  text-align: center;
  padding: 36px 20px;
}

.avatar-giant {
  font-size: 4rem;
  display: block;
  margin-bottom: 8px;
}

.welcome-header h2 {
  font-size: 1.8rem;
  font-weight: 800;
  color: #333;
}

.subtitle {
  color: #666;
  font-weight: 600;
  margin-top: 4px;
}

.team-showcase {
  border: 4px solid;
  border-radius: 16px;
  padding: 24px 16px;
  margin: 24px 0;
}

.team-giant-badge {
  font-size: 3.5rem;
  display: block;
}

.team-showcase h1 {
  font-size: 2.2rem;
  font-weight: 900;
  margin: 6px 0;
}

.team-showcase p {
  color: #555;
  font-weight: 600;
  font-size: 0.95rem;
}

.teammates-box {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.teammates-box h4 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 10px;
}

.teammates-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.teammate-tag {
  background: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 6px 12px;
  font-weight: 700;
  font-size: 0.85rem;
  color: #333;
}

.waiting-prompt {
  font-size: 1.1rem;
  font-weight: 800;
  color: #46178f;
}

/* QUESTION */
.q-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.q-num {
  font-weight: 800;
  font-size: 1.15rem;
  color: white;
}

.timer-badge {
  background: white;
  color: #46178f;
  font-weight: 900;
  font-size: 1.1rem;
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.timer-low {
  background: var(--kahoot-red);
  color: white;
  animation: pulseGlow 0.5s infinite;
}

.question-box {
  padding: 24px;
  text-align: center;
  margin-bottom: 20px;
}

.question-box h3 {
  font-size: 1.4rem;
  font-weight: 800;
  color: #222;
  line-height: 1.35;
}

.kahoot-buttons-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  min-height: 300px;
}

@media (max-width: 600px) {
  .kahoot-buttons-grid {
    grid-template-columns: 1fr;
    min-height: auto;
  }
}

.kahoot-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 14px;
  padding: 24px 20px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  color: white;
  text-align: left;
  transition: transform 0.1s, box-shadow 0.1s;
}

.kahoot-btn:active {
  transform: scale(0.97);
}

.shape-icon {
  font-size: 2.2rem;
  font-weight: 900;
}

.btn-text {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.answer-yellow {
  color: #222;
}

.locked-in-box {
  text-align: center;
  padding: 40px 20px;
}

.locked-tag {
  display: inline-block;
  background: #f0f0f0;
  color: #46178f;
  font-weight: 800;
  font-size: 0.85rem;
  padding: 4px 12px;
  border-radius: 12px;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.locked-in-box h2 {
  color: #46178f;
  font-size: 1.8rem;
  font-weight: 800;
}

.locked-in-box p {
  color: #666;
  margin-top: 6px;
  font-weight: 600;
}

.selected-summary {
  margin-top: 20px;
  padding: 14px 20px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
}

/* RESULT */
.result-card {
  text-align: center;
  padding: 36px 20px;
}

.result-correct {
  border-top: 8px solid #26890c;
}

.result-incorrect {
  border-top: 8px solid #e21b3c;
}

.result-icon {
  font-size: 4rem;
  display: block;
}

.result-banner h2 {
  font-size: 2.2rem;
  font-weight: 900;
  margin: 6px 0;
}

.result-correct h2 { color: #26890c; }
.result-incorrect h2 { color: #e21b3c; }

.points-badge {
  font-size: 1.3rem;
  font-weight: 800;
  color: #ffa602;
  margin-top: 6px;
}

.sub-msg {
  color: #666;
  font-weight: 600;
  margin-top: 6px;
}

.team-contribution-box {
  background: #f8f8f8;
  border-radius: 12px;
  padding: 16px;
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contrib-row {
  display: flex;
  justify-content: space-between;
  font-size: 1.05rem;
  color: #333;
}

.waiting-next-prompt {
  font-weight: 800;
  color: #46178f;
  font-size: 1rem;
}

/* ENDED */
.game-over-card {
  text-align: center;
  padding: 40px 20px;
}

.trophy-giant {
  font-size: 4.5rem;
  display: block;
}

.game-over-card h2 {
  font-size: 2.2rem;
  font-weight: 900;
  color: #46178f;
}

.final-rank-box {
  background: #f5f0ff;
  border-radius: 14px;
  padding: 24px;
  margin: 24px 0;
}

.rank-title {
  font-size: 0.95rem;
  color: #666;
  font-weight: 700;
}

.rank-number {
  font-size: 2.8rem;
  font-weight: 900;
  margin: 8px 0;
}

.place-1 { color: #d4af37; }
.place-2 { color: #888; }
.place-3 { color: #cd7f32; }

.final-team-score {
  font-size: 1.15rem;
  font-weight: 800;
  color: #46178f;
}

.btn-summary-link {
  width: 100%;
  padding: 16px;
  font-size: 1.15rem;
}
</style>
