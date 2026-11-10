import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { GameSession, Team, TeamMember, PlayerAnswerResult } from '@quizchaos/shared';
import { sessionMockService } from '../services/mockApi';

// Web Audio API sound generator for Kahoot sound effects
class SoundFX {
  private ctx: AudioContext | null = null;

  private getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTick() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  playCorrect() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.07);
        gain.gain.setValueAtTime(0.12, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.35);
      });
    } catch {}
  }

  playWrong() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  playFanfare() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.45);
      });
    } catch {}
  }
}

export const soundFX = new SoundFX();

interface BroadcastMessage {
  type: 'session:updated' | 'question:started' | 'question:ended' | 'session:ended';
  session: GameSession;
  answerStats?: number[];
}

export const useGameStore = defineStore('game', () => {
  const session = ref<GameSession | null>(null);
  const myTeam = ref<Team | null>(null);
  const myMember = ref<TeamMember | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const selectedAnswerIndex = ref<number | null>(null);
  const answerResult = ref<PlayerAnswerResult | null>(null);
  const answerStats = ref<number[]>([0, 0, 0, 0]);
  const timeRemaining = ref(20);
  const timerInterval = ref<ReturnType<typeof setInterval> | null>(null);

  // Cross-tab BroadcastChannel for M1 frontend-only multiplayer simulation
  let channel: BroadcastChannel | null = null;

  const isInLobby = computed(() => session.value?.status === 'lobby');
  const isQuestionActive = computed(() => session.value?.status === 'question_active');
  const isQuestionResult = computed(() => session.value?.status === 'question_result');
  const isEnded = computed(() => session.value?.status === 'ended');

  const rankedTeams = computed(() => {
    if (!session.value?.teams) return [];
    return [...session.value.teams].sort((a, b) => b.total_score - a.total_score);
  });

  function syncMyTeamAndMember(updated: GameSession, userId?: string) {
    session.value = JSON.parse(JSON.stringify(updated)) as GameSession;
    const targetUserId = userId || myMember.value?.user_id;
    if (targetUserId) {
      for (const team of session.value.teams) {
        const found = team.members.find(m => m.user_id === targetUserId);
        if (found) {
          myTeam.value = team;
          myMember.value = found;
          break;
        }
      }
    }
  }

  function broadcastUpdate(msg: BroadcastMessage) {
    if (channel) {
      channel.postMessage(msg);
    }
  }

  async function initSocket(roomCode: string, userId: string, _role = 'student') {
    loading.value = true;
    error.value = null;
    try {
      const initial = await sessionMockService.getSession(roomCode);
      syncMyTeamAndMember(initial, userId);

      if (typeof BroadcastChannel !== 'undefined' && !channel) {
        channel = new BroadcastChannel('qiuizez_m1_channel');
        channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
          const payload = event.data;
          if (!payload || payload.session.room_code !== roomCode) return;

          syncMyTeamAndMember(payload.session, userId);

          if (payload.type === 'question:started') {
            selectedAnswerIndex.value = null;
            answerResult.value = null;
            answerStats.value = [0, 0, 0, 0];
            startTimer(payload.session.current_question?.time_limit_seconds || 20);
          } else if (payload.type === 'question:ended') {
            stopTimer();
            if (payload.answerStats) {
              answerStats.value = payload.answerStats;
            }
          } else if (payload.type === 'session:ended') {
            stopTimer();
            soundFX.playFanfare();
          }
        };
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load mock session';
    } finally {
      loading.value = false;
    }
  }

  function startTimer(duration: number) {
    stopTimer();
    timeRemaining.value = duration;
    timerInterval.value = setInterval(() => {
      if (timeRemaining.value > 0) {
        timeRemaining.value--;
        if (timeRemaining.value <= 5 && timeRemaining.value > 0) {
          soundFX.playTick();
        }
      } else {
        stopTimer();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }
  }

  function submitAnswer(roomCode: string, userId: string, _questionId: string, optionIndex: number) {
    if (selectedAnswerIndex.value !== null) return;
    selectedAnswerIndex.value = optionIndex;

    const outcome = sessionMockService.submitAnswer(roomCode, userId, optionIndex, timeRemaining.value);
    if (outcome) {
      syncMyTeamAndMember(outcome.session, userId);
      answerResult.value = outcome.result;
      if (outcome.result.is_correct) {
        soundFX.playCorrect();
      } else {
        soundFX.playWrong();
      }
      broadcastUpdate({ type: 'session:updated', session: outcome.session });
    }
  }

  function hostStartGame(roomCode: string) {
    const updated = sessionMockService.startQuestion(roomCode, 0);
    if (updated) {
      syncMyTeamAndMember(updated);
      selectedAnswerIndex.value = null;
      answerResult.value = null;
      answerStats.value = [0, 0, 0, 0];
      startTimer(updated.current_question?.time_limit_seconds || 20);
      broadcastUpdate({ type: 'question:started', session: updated });
    }
  }

  function hostShowResult(roomCode: string) {
    stopTimer();
    const outcome = sessionMockService.revealQuestionResult(roomCode);
    if (outcome) {
      syncMyTeamAndMember(outcome.session);
      answerStats.value = outcome.answerStats;
      broadcastUpdate({
        type: 'question:ended',
        session: outcome.session,
        answerStats: outcome.answerStats
      });
    }
  }

  function hostNextQuestion(roomCode: string) {
    const nextIdx = (session.value?.current_question_index ?? 0) + 1;
    const updated = sessionMockService.startQuestion(roomCode, nextIdx);
    if (updated) {
      syncMyTeamAndMember(updated);
      if (updated.status === 'ended') {
        stopTimer();
        soundFX.playFanfare();
        broadcastUpdate({ type: 'session:ended', session: updated });
      } else {
        selectedAnswerIndex.value = null;
        answerResult.value = null;
        answerStats.value = [0, 0, 0, 0];
        startTimer(updated.current_question?.time_limit_seconds || 20);
        broadcastUpdate({ type: 'question:started', session: updated });
      }
    }
  }

  function hostRandomizeTeams(roomCode: string) {
    const updated = sessionMockService.randomizeTeams(roomCode);
    if (updated) {
      syncMyTeamAndMember(updated);
      broadcastUpdate({ type: 'session:updated', session: updated });
    }
  }

  function hostEndGame(roomCode: string) {
    stopTimer();
    const updated = sessionMockService.endSession(roomCode);
    if (updated) {
      syncMyTeamAndMember(updated);
      soundFX.playFanfare();
      broadcastUpdate({ type: 'session:ended', session: updated });
    }
  }

  function leaveSession() {
    stopTimer();
    if (channel) {
      channel.close();
      channel = null;
    }
    session.value = null;
    myTeam.value = null;
    myMember.value = null;
    selectedAnswerIndex.value = null;
    answerResult.value = null;
  }

  return {
    session,
    myTeam,
    myMember,
    loading,
    error,
    selectedAnswerIndex,
    answerResult,
    answerStats,
    timeRemaining,
    isInLobby,
    isQuestionActive,
    isQuestionResult,
    isEnded,
    rankedTeams,
    initSocket,
    submitAnswer,
    hostStartGame,
    hostShowResult,
    hostNextQuestion,
    hostRandomizeTeams,
    hostEndGame,
    leaveSession
  };
});
