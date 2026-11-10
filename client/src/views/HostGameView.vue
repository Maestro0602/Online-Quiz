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
        <!-- Top Room PIN Banner -->
        <div class="lobby-top-banner">
          <div class="lobby-pin-inline">
            <span class="join-prompt">Join on your phone or browser at room PIN:</span>
            <span class="giant-pin">{{ roomCode }}</span>
          </div>
          <div class="player-count-badge">
            {{ totalPlayersCount }} {{ totalPlayersCount === 1 ? 'Player' : 'Players' }} Connected
          </div>
        </div>

        <!-- 2-Column Split Layout: Left = Teams & Actions, Right = Big Spin Wheel & INPUTS List -->
        <div class="lobby-split-layout">
          <!-- LEFT COLUMN: Assigned Teams Board + Action Buttons -->
          <div class="lobby-teams-pane">
            <div class="pane-section-header">
              <span class="pane-title">Assigned Teams Board ({{ gameStore.session?.teams?.length || 4 }} Groups)</span>
              <span class="pane-sub">Auto-balanced by Spin Wheel</span>
            </div>

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
                  <span class="t-count">{{ team.members.length }}</span>
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
              <div class="lobby-action-row">
                <button
                  @click="triggerRandomizeWheel"
                  :disabled="totalPlayersCount === 0 || isSpinningWheel"
                  class="btn-kahoot btn-randomize"
                >
                  <span>Randomize Teams</span>
                </button>

                <button
                  @click="handleStartGameClick"
                  :disabled="totalPlayersCount === 0 || isStartingCountdown"
                  class="btn-kahoot btn-primary btn-start-game animate-pulse-slow"
                >
                  <span v-if="isStartingCountdown">Starting in {{ countdownTimer }}s...</span>
                  <span v-else>Start Game Now</span>
                </button>
              </div>
              <p v-if="totalPlayersCount === 0" class="sub-hint">
                Waiting for at least 1 player to join...
              </p>
            </div>
          </div>

          <!-- RIGHT COLUMN: Big Team Picker Wheel + INPUTS Roster -->
          <div class="lobby-wheel-inputs-pane">
            <!-- Big Team Picker Wheel Card -->
            <div class="wheel-side-card">
              <h3 class="wheel-side-title">Team Picker Wheel</h3>
              <p class="wheel-side-sub">
                {{ wheelResultText || 'Click START in the center to spin & shuffle teams' }}
              </p>

              <div class="wheel-spinner-wrapper">
                <div class="wheel-pointer">▼</div>
                <div
                  class="wheel-disc"
                  :style="{ transform: `rotate(${wheelRotation}deg)` }"
                >
                  <div
                    v-for="(team, idx) in gameStore.session?.teams"
                    :key="team.id"
                    class="wheel-slice"
                    :style="{
                      backgroundColor: team.color,
                      transform: `rotate(${(360 / (gameStore.session?.teams.length || 2)) * idx}deg)`
                    }"
                  >
                    <span class="slice-label">{{ team.name }}</span>
                  </div>
                </div>
                <button
                  class="wheel-center-start-btn"
                  :disabled="totalPlayersCount === 0 || isSpinningWheel"
                  @click="triggerRandomizeWheel"
                  title="Spin Wheel to Randomize Teams"
                >
                  {{ isSpinningWheel ? '...' : 'START' }}
                </button>
              </div>
            </div>

            <!-- INPUTS [N] Connected Players Roster Box -->
            <div class="all-students-roster-box">
              <div class="roster-header">
                <div class="inputs-heading-group">
                  <span class="roster-title">INPUTS</span>
                  <span class="inputs-count-box">{{ totalPlayersCount }}</span>
                </div>
                <span class="roster-sub">All Equal • {{ gameStore.session?.teams?.length || 4 }} Groups</span>
              </div>
              <div class="inputs-divider"></div>
              <div class="roster-rows-list">
                <div v-if="allConnectedStudents.length === 0" class="waiting-text">
                  Waiting for players to join with PIN {{ roomCode }}...
                </div>
                <div
                  v-for="st in allConnectedStudents"
                  :key="st.id"
                  class="student-input-row animate-pop"
                >
                  <span class="st-avatar">{{ st.avatar || st.user_name.substring(0, 2).toUpperCase() }}</span>
                  <span class="st-name">{{ st.user_name }}</span>
                  <span class="st-team-pill" :style="{ backgroundColor: st.teamColor }">{{ st.teamName }}</span>
                  <span class="st-check-box">✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Teams Assembled Countdown Overlay -->
    <div v-if="isStartingCountdown" class="teams-assembled-overlay">
      <div class="assembled-card card-kahoot animate-pop">
        <h2 class="assembled-title">Teams Assembled!</h2>
        <div class="countdown-giant">{{ countdownTimer }}</div>
        <p class="assembled-subtitle">Game starting... Get ready with your team!</p>
        <div class="assembled-teams-preview">
          <div
            v-for="team in gameStore.session?.teams"
            :key="team.id"
            class="assembled-team-pill"
            :style="{ borderColor: team.color }"
          >
            <span class="team-dot" :style="{ backgroundColor: team.color }"></span>
            <strong>{{ team.name }}</strong> ({{ team.members.length }} players)
          </div>
        </div>
      </div>
    </div>

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useGameStore, soundFX } from '../stores/game';
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

const allConnectedStudents = computed(() => {
  if (!gameStore.session?.teams) return [];
  const list: any[] = [];
  gameStore.session.teams.forEach(t => {
    t.members.forEach(m => {
      list.push({ ...m, teamColor: t.color, teamName: t.name });
    });
  });
  return list;
});

const isLastQuestion = computed(() => {
  if (!gameStore.session) return false;
  return gameStore.session.current_question_index >= (gameStore.session.total_questions - 1);
});

// Wheel & Starting countdown state
const isSpinningWheel = ref(false);
const showWheelModal = ref(false);
const wheelRotation = ref(0);
const wheelResultText = ref('');
const isStartingCountdown = ref(false);
const countdownTimer = ref(3);

function triggerRandomizeWheel() {
  if (totalPlayersCount.value === 0 || isSpinningWheel.value) return;
  showWheelModal.value = true;
  isSpinningWheel.value = true;
  wheelResultText.value = 'Spinning the Wheel to Balance Teams...';

  const extraSpins = 1440 + Math.floor(Math.random() * 720);
  wheelRotation.value += extraSpins;

  let tickCount = 0;
  const tickInterval = setInterval(() => {
    soundFX.playTick();
    tickCount++;
    if (tickCount >= 10) clearInterval(tickInterval);
  }, 200);

  setTimeout(() => {
    gameStore.hostRandomizeTeams(roomCode.value);
    wheelResultText.value = 'Teams Successfully Random & Balanced!';
    isSpinningWheel.value = false;
    soundFX.playCorrect();
    setTimeout(() => {
      showWheelModal.value = false;
    }, 1500);
  }, 2500);
}

function handleStartGameClick() {
  if (totalPlayersCount.value === 0) return;
  isStartingCountdown.value = true;
  countdownTimer.value = 3;
  soundFX.playTick();
  const timer = setInterval(() => {
    countdownTimer.value--;
    if (countdownTimer.value > 0) {
      soundFX.playTick();
    } else {
      clearInterval(timer);
      isStartingCountdown.value = false;
      gameStore.hostStartGame(roomCode.value);
    }
  }, 1000);
}

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
  text-align: left;
  padding: 28px;
}

.lobby-top-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: rgba(0, 0, 0, 0.05);
  border: 1.5px solid var(--theme-card-border);
  border-radius: 12px;
  padding: 14px 22px;
  margin-bottom: 24px;
}

.lobby-pin-inline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.join-prompt {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--theme-card-text);
}

.giant-pin {
  font-size: 2.6rem;
  font-weight: 900;
  color: #46178f;
  letter-spacing: 5px;
  line-height: 1;
}

.player-count-badge {
  display: inline-block;
  background: #ffffff;
  color: #222;
  border: 1.5px solid var(--theme-card-border);
  font-weight: 800;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 1rem;
}

.lobby-split-layout {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  gap: 28px;
  align-items: stretch;
}

@media (max-width: 960px) {
  .lobby-split-layout {
    grid-template-columns: 1fr;
  }
}

.lobby-teams-pane {
  display: flex;
  flex-direction: column;
}

.pane-section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.pane-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--theme-card-text);
}

.pane-sub {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--theme-card-text);
  opacity: 0.75;
}

.teams-lobby-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  margin-bottom: 22px;
  flex: 1;
}

@media (max-width: 600px) {
  .teams-lobby-grid {
    grid-template-columns: 1fr;
  }
}

.team-lobby-box {
  border: 3px solid;
  border-radius: 12px;
  overflow: hidden;
  background: #fafafa;
  min-height: 210px;
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

.t-count {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 0.85rem;
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
  color: #222;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.btn-start-game {
  flex: 1;
  font-size: 1.35rem;
  padding: 16px 32px;
  border-radius: 12px;
}

.sub-hint {
  color: #777;
  font-size: 0.9rem;
  margin-top: 8px;
  text-align: center;
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

/* RIGHT COLUMN: WHEEL + INPUTS ROSTER */
.lobby-wheel-inputs-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.wheel-side-card {
  background: rgba(255, 255, 255, 0.55);
  border: 2px solid var(--theme-card-border);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.wheel-side-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--theme-card-text);
  margin: 0 0 4px;
}

.wheel-side-sub {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--theme-card-text);
  opacity: 0.8;
  margin: 0 0 18px;
}

/* ALL STUDENTS / INPUTS ROSTER */
.all-students-roster-box {
  background: #fafafa;
  border: 2px solid var(--theme-card-border);
  border-radius: 12px;
  padding: 16px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.inputs-heading-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.roster-title {
  font-weight: 900;
  font-size: 1.1rem;
  color: #222;
  letter-spacing: 0.5px;
}

.inputs-count-box {
  background: #ffffff;
  border: 1.5px solid #888;
  color: #222;
  font-weight: 800;
  font-size: 0.85rem;
  padding: 1px 8px;
  border-radius: 4px;
}

.roster-sub {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--theme-card-text);
}

.inputs-divider {
  border-bottom: 1.5px dashed #ccc;
  margin-bottom: 12px;
}

.roster-rows-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 210px;
  overflow-y: auto;
}

.student-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f1f1f1;
  border: 1px solid #e0e0e0;
  padding: 7px 12px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.9rem;
  color: #222;
}

.st-avatar {
  background: var(--theme-card-border);
  color: var(--theme-card-bg);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.st-name {
  flex: 1;
  text-align: left;
}

.st-team-pill {
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 10px;
  border-radius: 12px;
}

.st-check-box {
  width: 20px;
  height: 20px;
  border: 1.5px solid #333;
  border-radius: 4px;
  background: #ffffff;
  color: #222;
  font-size: 0.75rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* LOBBY ACTION ROW */
.lobby-action-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  flex-wrap: wrap;
  width: 100%;
}

.btn-randomize {
  background: var(--theme-card-bg);
  color: var(--theme-card-text);
  border: 1.5px solid var(--theme-card-border);
  box-shadow: 0 4px 0 var(--theme-card-border);
  padding: 16px 24px;
  font-size: 1.1rem;
}

.btn-randomize:hover:not(:disabled) {
  background: var(--theme-card-border);
  color: var(--theme-card-bg);
}

/* WHEEL SPINNER & CENTER START HUB */
.teams-assembled-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.wheel-spinner-wrapper {
  position: relative;
  width: 224px;
  height: 224px;
  margin: 0 auto;
}

.wheel-pointer {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.7rem;
  color: var(--theme-card-text);
  z-index: 10;
}

.wheel-disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4px solid var(--theme-card-border);
  position: relative;
  overflow: hidden;
  transition: transform 2.5s cubic-bezier(0.15, 0.9, 0.2, 1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.wheel-center-start-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #1b1b1b;
  color: #ffffff;
  border: 4px solid #ffffff;
  font-family: inherit;
  font-weight: 900;
  font-size: 0.95rem;
  letter-spacing: 1px;
  cursor: pointer;
  z-index: 15;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  transition: transform 0.15s ease, background 0.15s ease;
}

.wheel-center-start-btn:hover:not(:disabled) {
  transform: translate(-50%, -50%) scale(1.06);
  background: #086288;
}

.wheel-center-start-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wheel-slice {
  position: absolute;
  top: 0;
  left: 50%;
  width: 50%;
  height: 50%;
  transform-origin: 0% 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(0% 0%, 100% 0%, 100% 100%);
}

.slice-label {
  color: white;
  font-weight: 800;
  font-size: 0.75rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  transform: rotate(45deg);
}

/* TEAMS ASSEMBLED OVERLAY */
.assembled-card {
  max-width: 550px;
  width: 100%;
  text-align: center;
  padding: 36px 24px;
}

.assembled-title {
  font-size: 2.2rem;
  font-weight: 900;
  color: var(--theme-card-text);
}

.countdown-giant {
  font-size: 4.5rem;
  font-weight: 900;
  color: var(--theme-card-text);
  margin: 12px 0;
}

.assembled-subtitle {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 24px;
  opacity: 0.85;
}

.assembled-teams-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.assembled-team-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border: 2px solid;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 1.05rem;
}

.team-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
</style>
