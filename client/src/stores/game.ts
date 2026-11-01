import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io, Socket } from 'socket.io-client';
import { GameSession, Team, TeamMember, PlayerAnswerResult } from '@quizchaos/shared';

// Web Audio API sound generator for Kahoot sound effects
class SoundFX {
  private ctx: AudioContext | null = null;

  private getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
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

export const useGameStore = defineStore('game', () => {
  const socket = ref<Socket | null>(null);
  const session = ref<GameSession | null>(null);
  const myTeam = ref<Team | null>(null);
  const myMember = ref<TeamMember | null>(null);

  const selectedAnswerIndex = ref<number | null>(null);
  const answerResult = ref<PlayerAnswerResult | null>(null);
  const answerStats = ref<number[]>([0, 0, 0, 0]);
  const timeRemaining = ref(20);
  const timerInterval = ref<any>(null);

  const isInLobby = computed(() => session.value?.status === 'lobby');
  const isQuestionActive = computed(() => session.value?.status === 'question_active');
  const isQuestionResult = computed(() => session.value?.status === 'question_result');
  const isEnded = computed(() => session.value?.status === 'ended');

  // Sorted teams by total_score descending
  const rankedTeams = computed(() => {
    if (!session.value?.teams) return [];
    return [...session.value.teams].sort((a, b) => b.total_score - a.total_score);
  });

  function initSocket(roomCode: string, userId: string, role = 'student') {
    if (!socket.value) {
      socket.value = io({
        transports: ['websocket', 'polling']
      });

      socket.value.on('connect', () => {
        socket.value?.emit('session:join', { room_code: roomCode, user_id: userId, role });
      });

      socket.value.on('session:updated', (updated: GameSession) => {
        session.value = updated;
        // Re-sync my team and member if exists
        if (myMember.value) {
          for (const team of updated.teams) {
            const found = team.members.find(m => m.user_id === myMember.value?.user_id);
            if (found) {
              myTeam.value = team;
              myMember.value = found;
              break;
            }
          }
        }
      });

      socket.value.on('question:started', (payload: any) => {
        selectedAnswerIndex.value = null;
        answerResult.value = null;
        answerStats.value = [0, 0, 0, 0];
        startTimer(payload.time_limit || 20);
      });

      socket.value.on('player:answer_result', (result: PlayerAnswerResult) => {
        answerResult.value = result;
        if (result.is_correct) {
          soundFX.playCorrect();
        } else {
          soundFX.playWrong();
        }
      });

      socket.value.on('question:ended', (payload: any) => {
        stopTimer();
        if (payload.answer_stats) {
          answerStats.value = payload.answer_stats;
        }
      });

      socket.value.on('session:ended', () => {
        stopTimer();
        soundFX.playFanfare();
      });
    } else {
      socket.value.emit('session:join', { room_code: roomCode, user_id: userId, role });
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

  function submitAnswer(roomCode: string, userId: string, questionId: string, optionIndex: number) {
    if (selectedAnswerIndex.value !== null) return;
    selectedAnswerIndex.value = optionIndex;
    socket.value?.emit('player:submit_answer', {
      room_code: roomCode,
      user_id: userId,
      question_id: questionId,
      selected_option_index: optionIndex,
      time_remaining: timeRemaining.value
    });
  }

  function hostStartGame(roomCode: string) {
    socket.value?.emit('session:start', { room_code: roomCode });
  }

  function hostShowResult(roomCode: string) {
    socket.value?.emit('session:show_result', { room_code: roomCode });
  }

  function hostNextQuestion(roomCode: string) {
    socket.value?.emit('session:next_question', { room_code: roomCode });
  }

  function hostRandomizeTeams(roomCode: string) {
    socket.value?.emit('session:randomize_teams', { room_code: roomCode });
  }

  function hostEndGame(roomCode: string) {
    socket.value?.emit('session:end', { room_code: roomCode });
  }

  function leaveSession() {
    stopTimer();
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
    session.value = null;
    myTeam.value = null;
    myMember.value = null;
    selectedAnswerIndex.value = null;
    answerResult.value = null;
  }

  return {
    socket,
    session,
    myTeam,
    myMember,
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
    hostRandomizeTeams,
    hostShowResult,
    hostNextQuestion,
    hostEndGame,
    leaveSession
  };
});

