<template>
  <div class="host-view">
    <!-- Header with PIN and Controls -->
    <header class="host-header">
      <div class="header-left">
        <span class="quiz-badge">Host View</span>
        <h2 class="session-title">{{ gameStore.session?.quiz_title || 'Quiz Session' }}</h2>
      </div>

      <div class="pin-display">
        <span class="pin-label">GAME PIN:</span>
        <span class="pin-number">{{ roomCode }}</span>
      </div>

      <div class="header-actions">
        <button
          v-if="!gameStore.isEnded"
          @click="confirmEndGame"
          class="btn-kahoot btn-red btn-sm"
        >
          End Game
        </button>
      </div>
    </header>

    <!-- STAGE 1: LOBBY -->
    <section v-if="gameStore.isInLobby" class="lobby-stage animate-pop">
      <div class="lobby-center-card card-kahoot">
        <div class="lobby-qr-pin">
          <p class="join-prompt">Join on your phone or browser at this room PIN:</p>
          <div class="giant-pin">{{ roomCode }}</div>
          <div class="player-count-badge">
            {{ totalPlayersCount }} {{ totalPlayersCount === 1 ? 'Player' : 'Players' }} Connected
          </div>
        </div>

        <!-- Balanced Teams Grid -->
        <div class="teams-lobby-grid">
          <div
            v-for="team in gameStore.session?.teams"
            :key="team.id"
            class="team-lobby-box"
            :style="{ borderColor: team.color }"
          >
            <div class="team-box-header" :style="{ backgroundColor: team.color }">
              <span class="t-badge">[{{ team.badge }}]</span>
              <span class="t-name">{{ team.name }}</span>
              <span class="t-count">({{ team.members.length }})</span>
            </div>

            <div class="team-members-list">
              <div v-if="team.members.length === 0" class="waiting-text">
                Waiting for teammates...
              </div>
              <div
                v-for="member in team.members"
                :key="member.id"
                class="member-chip animate-pop"
              >
                <span>[{{ member.avatar || member.user_name.substring(0, 2).toUpperCase() }}]</span>
                <span>{{ member.user_name }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="start-action">
          <button
            @click="startGame"
            :disabled="totalPlayersCount === 0"
            class="btn-kahoot btn-primary btn-start-game animate-pulse-slow"
          >
            <span>Start Game Now</span>
          </button>
          <p v-if="totalPlayersCount === 0" class="sub-hint">
            Waiting for at least 1 player to join...
          </p>
        </div>
      </div>
    </section>

    <!-- STAGE 2: QUESTION ACTIVE -->
    <section v-else-if="gameStore.isQuestionActive" class="question-stage">
      <div class="q-top-bar">
        <div class="q-progress">
          Question {{ (gameStore.session?.current_question_index || 0) + 1 }} / {{ gameStore.session?.total_questions }}
        </div>
        <div class="q-timer-circle" :class="{ 'warning': gameStore.timeRemaining <= 5 }">
          {{ gameStore.timeRemaining }}
        </div>
        <div class="q-controls">
          <button @click="revealAnswer" class="btn-kahoot btn-white btn-sm">
            Skip / Reveal Answer →
          </button>
        </div>
      </div>

      <!-- Question Prompt -->
      <div class="prompt-container card-kahoot animate-pop">
        <h2>{{ currentQuestion?.prompt }}</h2>
      </div>

      <!-- 4 Kahoot Shape Options -->
      <div class="options-display-grid">
        <div class="opt-card opt-red animate-pop">
          <span class="opt-shape">▲</span>
          <span class="opt-text">{{ currentQuestion?.options[0] || '' }}</span>
        </div>
        <div class="opt-card opt-blue animate-pop">
          <span class="opt-shape">◆</span>
          <span class="opt-text">{{ currentQuestion?.options[1] || '' }}</span>
        </div>
        <div class="opt-card opt-yellow animate-pop">
          <span class="opt-shape">●</span>
          <span class="opt-text">{{ currentQuestion?.options[2] || '' }}</span>
        </div>
        <div class="opt-card opt-green animate-pop">
          <span class="opt-shape">■</span>
          <span class="opt-text">{{ currentQuestion?.options[3] || '' }}</span>
        </div>
      </div>
    </section>

    <!-- STAGE 3: QUESTION RESULT & LEADERBOARD -->
    <section v-else-if="gameStore.isQuestionResult" class="result-stage animate-pop">
      <div class="result-container card-kahoot">
        <div class="result-header">
          <h2>Question Result & Team Leaderboard</h2>
          <button
            v-if="isLastQuestion"
            @click="nextQuestion"
            class="btn-kahoot btn-yellow btn-next"
          >
            Final Podium
          </button>
          <button
            v-else
            @click="nextQuestion"
            class="btn-kahoot btn-primary btn-next"
          >
            Next Question →
          </button>
        </div>

        <!-- Answer Stats Breakdown -->
        <div class="answer-breakdown-row">
          <div
            v-for="(stat, idx) in gameStore.answerStats"
            :key="idx"
            class="stat-pill"
            :class="[
              getShapeClass(idx),
              { 'correct-highlight': idx === currentQuestion?.correct_option_index }
            ]"
          >
            <span class="stat-shape">{{ getShapeSymbol(idx) }}</span>
            <span class="stat-votes">{{ stat }} {{ stat === 1 ? 'vote' : 'votes' }}</span>
            <span v-if="idx === currentQuestion?.correct_option_index" class="correct-badge">
              Correct
            </span>
          </div>
        </div>

        <!-- Current Team Leaderboard -->
        <div class="leaderboard-table">
          <h3>Team Standings</h3>
          <div
            v-for="(team, rank) in gameStore.rankedTeams"
            :key="team.id"
            class="leaderboard-row animate-pop"
          >
            <div class="rank-badge" :class="'rank-' + (rank + 1)">#{{ rank + 1 }}</div>
            <div class="team-info">
              <span class="team-badge-icon">[{{ team.badge }}]</span>
              <strong class="team-title" :style="{ color: team.color }">{{ team.name }}</strong>
              <span class="team-sub">({{ team.members.length }} members)</span>
            </div>
            <div class="team-score">{{ team.total_score.toLocaleString() }} pts</div>
          </div>
        </div>
      </div>
    </section>

    <!-- STAGE 4: ENDED & PODIUM -->
    <section v-else-if="gameStore.isEnded" class="ended-stage animate-pop">
      <div class="podium-card card-kahoot">
        <div class="podium-header">
          <h1>Battle Completed</h1>
          <p>Congratulations to all teams!</p>
        </div>

        <!-- 3-Tier Podium -->
        <div class="podium-container">
          <!-- 2nd Place -->
          <div v-if="gameStore.rankedTeams[1]" class="podium-step step-2 animate-pop">
            <div class="podium-team-header">
              <span class="team-icon">[{{ gameStore.rankedTeams[1].badge }}]</span>
              <h4>{{ gameStore.rankedTeams[1].name }}</h4>
              <div class="podium-score">{{ gameStore.rankedTeams[1].total_score.toLocaleString() }} pts</div>
            </div>
            <div class="podium-block block-silver">
              <span class="rank-label">2nd Place</span>
            </div>
          </div>

          <!-- 1st Place Champion -->
          <div v-if="gameStore.rankedTeams[0]" class="podium-step step-1 animate-pop">
            <div class="podium-team-header">
              <span class="team-icon">[{{ gameStore.rankedTeams[0].badge }}]</span>
              <h3>{{ gameStore.rankedTeams[0].name }}</h3>
              <div class="podium-score champion">{{ gameStore.rankedTeams[0].total_score.toLocaleString() }} pts</div>
            </div>
            <div class="podium-block block-gold">
              <span class="rank-label">1st Place</span>
            </div>
          </div>

          <!-- 3rd Place -->
          <div v-if="gameStore.rankedTeams[2]" class="podium-step step-3 animate-pop">
            <div class="podium-team-header">
              <span class="team-icon">[{{ gameStore.rankedTeams[2].badge }}]</span>
              <h4>{{ gameStore.rankedTeams[2].name }}</h4>
              <div class="podium-score">{{ gameStore.rankedTeams[2].total_score.toLocaleString() }} pts</div>
            </div>
            <div class="podium-block block-bronze">
              <span class="rank-label">3rd Place</span>
            </div>
          </div>
        </div>

        <div class="podium-footer">
          <router-link
            :to="`/summary/${roomCode}`"
            class="btn-kahoot btn-primary btn-summary"
          >
            View Post-Game Summary & Top Contributors →
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useGameStore } from '../stores/game';
import confetti from 'canvas-confetti';

const route = useRoute();
const authStore = useAuthStore();
const gameStore = useGameStore();

const roomCode = computed(() => route.params.roomCode as string);

const currentQuestion = computed(() => gameStore.session?.current_question);

const totalPlayersCount = computed(() => {
  if (!gameStore.session?.teams) return 0;
  return gameStore.session.teams.reduce((acc, t) => acc + t.members.length, 0);
});

const isLastQuestion = computed(() => {
  if (!gameStore.session) return false;
  return gameStore.session.current_question_index >= (gameStore.session.total_questions - 1);
});

onMounted(async () => {
  // Fetch initial session state
  try {
    const res = await fetch(`/api/sessions/${roomCode.value}`);
    if (res.ok) {
      const data = await res.json();
      gameStore.session = data.session;
    }
  } catch (err) {
    console.error('Error fetching session', err);
  }

  // Initialize socket
  gameStore.initSocket(roomCode.value, authStore.user?.id || 'host-user', 'instructor');
});

// Watch for game ended to fire confetti
watch(() => gameStore.isEnded, (ended) => {
  if (ended) {
    fireConfetti();
  }
});

function fireConfetti() {
  try {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch {}
}

function startGame() {
  gameStore.hostStartGame(roomCode.value);
}

function revealAnswer() {
  gameStore.hostShowResult(roomCode.value);
}

function nextQuestion() {
  gameStore.hostNextQuestion(roomCode.value);
}

function confirmEndGame() {
  if (confirm('Are you sure you want to end this game session?')) {
    gameStore.hostEndGame(roomCode.value);
  }
}

function getShapeSymbol(idx: number) {
  return ['▲', '◆', '●', '■'][idx] || '';
}

function getShapeClass(idx: number) {
  return ['opt-red', 'opt-blue', 'opt-yellow', 'opt-green'][idx] || '';
}

onUnmounted(() => {
  // keep game session alive or leave
});
</script>

<style scoped>
.host-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.host-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: rgba(0, 0, 0, 0.3);
  padding: 12px 24px;
  border-radius: 14px;
  margin-bottom: 24px;
}

.quiz-badge {
  font-size: 0.75rem;
  background: #ffa602;
  color: #222;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 12px;
}

.session-title {
  color: white;
  font-size: 1.4rem;
  margin-top: 2px;
}

.pin-display {
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
  padding: 8px 18px;
  border-radius: 30px;
}

.pin-label {
  font-weight: 800;
  font-size: 0.85rem;
  color: #666;
}

.pin-number {
  font-size: 1.6rem;
  font-weight: 900;
  color: #46178f;
  letter-spacing: 2px;
}

/* LOBBY */
.lobby-center-card {
  text-align: center;
  padding: 36px;
}

.join-prompt {
  font-size: 1.2rem;
  font-weight: 700;
  color: #555;
}

.giant-pin {
  font-size: 3.8rem;
  font-weight: 900;
  color: #46178f;
  letter-spacing: 8px;
  margin: 12px 0;
}

.player-count-badge {
  display: inline-block;
  background: #f0f0f0;
  color: #333;
  font-weight: 800;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 1.05rem;
}

.teams-lobby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
  margin: 36px 0;
}

.team-lobby-box {
  border: 3px solid;
  border-radius: 12px;
  overflow: hidden;
  background: #fafafa;
  min-height: 180px;
  display: flex;
  flex-direction: column;
}

.team-box-header {
  color: white;
  padding: 10px 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}

.t-name {
  flex: 1;
  text-align: left;
}

.team-members-list {
  padding: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  align-content: flex-start;
}

.waiting-text {
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
  margin: auto;
}

.member-chip {
  background: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 6px 12px;
  font-weight: 700;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.btn-start-game {
  font-size: 1.4rem;
  padding: 18px 48px;
  border-radius: 12px;
}

.sub-hint {
  color: #777;
  font-size: 0.9rem;
  margin-top: 8px;
}

/* QUESTION STAGE */
.q-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.q-progress {
  color: white;
  font-weight: 800;
  font-size: 1.3rem;
}

.q-timer-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: white;
  color: #46178f;
  font-size: 2.2rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  transition: all 0.2s ease;
}

.q-timer-circle.warning {
  background: var(--kahoot-red);
  color: white;
  animation: pulseGlow 0.5s infinite;
}

.prompt-container {
  text-align: center;
  padding: 36px 24px;
  margin-bottom: 24px;
}

.prompt-container h2 {
  font-size: 2rem;
  font-weight: 800;
  color: #222;
  line-height: 1.3;
}

.options-display-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.opt-card {
  padding: 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: white;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.2);
}

.opt-shape {
  font-size: 2rem;
}

.opt-text {
  font-size: 1.4rem;
  font-weight: 700;
}

.opt-red { background-color: var(--kahoot-red); }
.opt-blue { background-color: var(--kahoot-blue); }
.opt-yellow { background-color: var(--kahoot-yellow); color: #222; }
.opt-green { background-color: var(--kahoot-green); }

/* RESULT STAGE */
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.result-header h2 {
  color: #46178f;
  font-weight: 800;
}

.answer-breakdown-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 30px;
}

.stat-pill {
  padding: 16px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  font-weight: 800;
  gap: 4px;
  position: relative;
}

.stat-shape {
  font-size: 1.6rem;
}

.stat-votes {
  font-size: 1.1rem;
}

.correct-badge {
  background: white;
  color: #26890c;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-top: 4px;
}

.stat-pill.correct-highlight {
  outline: 4px solid #26890c;
}

.leaderboard-table h3 {
  font-weight: 800;
  color: #333;
  margin-bottom: 14px;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-radius: 10px;
  background: #f8f8f8;
  margin-bottom: 10px;
  border: 1px solid #eee;
}

.rank-badge {
  font-weight: 900;
  font-size: 1.2rem;
  width: 45px;
}

.rank-1 { color: #d4af37; }
.rank-2 { color: #aaa; }
.rank-3 { color: #cd7f32; }

.team-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
}

.team-sub {
  font-size: 0.85rem;
  color: #777;
  font-weight: 500;
}

.team-score {
  font-size: 1.3rem;
  font-weight: 800;
  color: #46178f;
}

/* PODIUM */
.podium-card {
  text-align: center;
  padding: 40px 20px;
}

.celebration-emoji {
  font-size: 4rem;
  display: block;
}

.podium-header h1 {
  font-size: 2.6rem;
  font-weight: 900;
  color: #46178f;
}

.podium-header p {
  color: #666;
  font-weight: 600;
}

.podium-container {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 16px;
  margin: 50px auto 30px;
  max-width: 650px;
  min-height: 280px;
}

.podium-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.crown-icon {
  font-size: 2.2rem;
  margin-bottom: -6px;
}

.podium-team-header {
  margin-bottom: 12px;
}

.podium-team-header .team-icon {
  font-size: 2.2rem;
  display: block;
}

.podium-team-header h3, .podium-team-header h4 {
  font-weight: 800;
  margin: 4px 0;
  color: #333;
}

.podium-score {
  font-size: 1.1rem;
  font-weight: 800;
  color: #666;
}

.podium-score.champion {
  font-size: 1.3rem;
  color: #46178f;
}

.podium-block {
  width: 100%;
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 900;
}

.step-1 .podium-block {
  height: 180px;
  background: linear-gradient(180deg, #f1c40f 0%, #d4ac0d 100%);
  box-shadow: 0 8px 0 #b7950b;
}

.step-2 .podium-block {
  height: 130px;
  background: linear-gradient(180deg, #bdc3c7 0%, #95a5a6 100%);
  box-shadow: 0 8px 0 #7f8c8d;
}

.step-3 .podium-block {
  height: 90px;
  background: linear-gradient(180deg, #e67e22 0%, #d35400 100%);
  box-shadow: 0 8px 0 #ba4a00;
}

.rank-label {
  font-size: 1.4rem;
}

.podium-footer {
  margin-top: 36px;
}

.btn-summary {
  font-size: 1.15rem;
  padding: 14px 28px;
}
</style>
