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

export interface TeammatePick {
  user_id: string;
  user_name: string;
  avatar: string;
  selected_option_index: number;
}

const TEAM_PRESETS = [
  { name: 'Red Rockets', color: '#e21b3c', badge: 'R' },
  { name: 'Blue Blasters', color: '#1368ce', badge: 'B' },
  { name: 'Golden Geeks', color: '#d88b02', badge: 'G' },
  { name: 'Green Giants', color: '#26890c', badge: 'V' }
];

export const useGameStore = defineStore('game', () => {
  const socket = ref<Socket | null>(null);
  const session = ref<GameSession | null>(null);
  const myTeam = ref<Team | null>(null);
  const myMember = ref<TeamMember | null>(null);

  const selectedAnswerIndex = ref<number | null>(null);
  const answerResult = ref<PlayerAnswerResult | null>(null);
  const answerStats = ref<number[]>([0, 0, 0, 0]);
  const answersReceived = ref(0);
  const totalActivePlayers = ref(0);
  const teammatePicks = ref<TeammatePick[]>([]);
  const teamSyncBonusAwarded = ref(0);
  const sessionLoading = ref(false);
  const sessionError = ref<string | null>(null);
  const autoReveal = ref(false);
  const activeRoomCode = ref('');
  const activeRole = ref('student');
  const hasAutoRevealedQuestion = ref(false);
  const timeRemaining = ref(20);
  const timerInterval = ref<any>(null);

  function loadHostSettings(userId: string) {
    const key = `qiuizez_host_settings_${userId || 'guest-host'}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        autoReveal.value = !!parsed.autoReveal;
      } else {
        autoReveal.value = false;
      }
    } catch {
      autoReveal.value = false;
    }
  }

  function toggleAutoReveal(userId: string) {
    autoReveal.value = !autoReveal.value;
    const key = `qiuizez_host_settings_${userId || 'guest-host'}`;
    try {
      localStorage.setItem(key, JSON.stringify({ autoReveal: autoReveal.value }));
    } catch {}
  }

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
    activeRoomCode.value = roomCode;
    activeRole.value = role;

    if (!socket.value) {
      socket.value = io({
        transports: ['websocket', 'polling']
      });

      socket.value.on('connect', () => {
        socket.value?.emit('session:join', { room_code: activeRoomCode.value, user_id: userId, role: activeRole.value });
      });

      socket.value.on('session:updated', (updated: GameSession) => {
        session.value = updated;
        sessionError.value = null;
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
        answersReceived.value = 0;
        teammatePicks.value = [];
        teamSyncBonusAwarded.value = 0;
        hasAutoRevealedQuestion.value = false;
        totalActivePlayers.value = session.value
          ? session.value.teams.reduce((s, t) => s + t.members.length, 0)
          : 0;
        startTimer(payload.time_limit || 20);
      });

      socket.value.on(
        'team:member_picked',
        (payload: {
          team_id: string;
          user_id: string;
          user_name: string;
          avatar: string;
          selected_option_index: number;
        }) => {
          if (!myTeam.value || payload.team_id !== myTeam.value.id) return;
          const filtered = teammatePicks.value.filter(p => p.user_id !== payload.user_id);
          filtered.push({
            user_id: payload.user_id,
            user_name: payload.user_name,
            avatar: payload.avatar,
            selected_option_index: payload.selected_option_index
          });
          teammatePicks.value = filtered;
        }
      );

      socket.value.on(
        'team:sync_bonus',
        (payload: {
          team_id: string;
          team_name: string;
          bonus_points: number;
          updated_team_score: number;
        }) => {
          if (myTeam.value && payload.team_id === myTeam.value.id) {
            teamSyncBonusAwarded.value = payload.bonus_points;
            myTeam.value.total_score = payload.updated_team_score;
          }
        }
      );

      socket.value.on('question:progress', (payload: { answers_received: number; total_players: number }) => {
        answersReceived.value = payload.answers_received;
        totalActivePlayers.value = payload.total_players;
        if (
          activeRole.value === 'instructor' &&
          autoReveal.value &&
          !hasAutoRevealedQuestion.value &&
          isQuestionActive.value &&
          payload.total_players > 0 &&
          payload.answers_received >= payload.total_players
        ) {
          hasAutoRevealedQuestion.value = true;
          hostShowResult(activeRoomCode.value);
        }
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
        if (
          activeRole.value === 'instructor' &&
          autoReveal.value &&
          !hasAutoRevealedQuestion.value &&
          isQuestionActive.value
        ) {
          hasAutoRevealedQuestion.value = true;
          soundFX.playTick();
          hostShowResult(activeRoomCode.value);
        }
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

  function hostAddPlayer(roomCode: string, userName: string) {
    const cleanName = userName.trim();
    if (!cleanName) return;

    if (session.value?.id.startsWith('preview-') && session.value.teams.length > 0) {
      const targetTeam = session.value.teams.reduce(
        (min, t) => (t.members.length < min.members.length ? t : min),
        session.value.teams[0]
      );
      const suffix = Math.random().toString(36).slice(2, 6);
      targetTeam.members.push({
        id: `m-${Date.now()}-${suffix}`,
        user_id: `u-${Date.now()}-${suffix}`,
        user_name: cleanName,
        team_id: targetTeam.id,
        individual_score: 0,
        is_online: true,
        avatar: cleanName.substring(0, 2).toUpperCase()
      });
      return;
    }

    socket.value?.emit('session:add_player', { room_code: roomCode, user_name: cleanName });
  }

  function hostRemovePlayer(roomCode: string, memberId: string) {
    if (session.value?.id.startsWith('preview-')) {
      for (const team of session.value.teams) {
        team.members = team.members.filter(m => m.id !== memberId && m.user_id !== memberId);
      }
      return;
    }

    socket.value?.emit('session:remove_player', { room_code: roomCode, member_id: memberId });
  }

  function hostSetTeamCount(roomCode: string, teamCount: number) {
    const count = Math.max(2, Math.min(4, Number(teamCount) || 2));

    if (session.value?.id.startsWith('preview-')) {
      const allMembers: TeamMember[] = [];
      for (const team of session.value.teams) {
        allMembers.push(...team.members);
      }
      const nextTeams: Team[] = [];
      for (let i = 0; i < count; i++) {
        const preset = TEAM_PRESETS[i % TEAM_PRESETS.length];
        nextTeams.push({
          id: `t-preview-${i + 1}`,
          session_id: roomCode,
          name: preset.name,
          color: preset.color,
          badge: preset.badge,
          total_score: 0,
          members: []
        });
      }
      allMembers.forEach((member, idx) => {
        const targetTeam = nextTeams[idx % count];
        member.team_id = targetTeam.id;
        targetTeam.members.push(member);
      });
      session.value.teams = nextTeams;
      session.value.team_count = count;
      return;
    }

    socket.value?.emit('session:set_team_count', { room_code: roomCode, team_count: count });
  }

  function hostRandomizeTeams(roomCode: string) {
    if (session.value?.id.startsWith('preview-') && session.value.teams.length > 0) {
      const allMembers: TeamMember[] = [];
      for (const team of session.value.teams) {
        allMembers.push(...team.members);
        team.members = [];
      }
      for (let i = allMembers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allMembers[i], allMembers[j]] = [allMembers[j], allMembers[i]];
      }
      allMembers.forEach((member, index) => {
        const targetTeam = session.value!.teams[index % session.value!.teams.length];
        member.team_id = targetTeam.id;
        targetTeam.members.push(member);
      });
      return;
    }

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
    answersReceived.value = 0;
    totalActivePlayers.value = 0;
    teammatePicks.value = [];
    teamSyncBonusAwarded.value = 0;
    sessionLoading.value = false;
    sessionError.value = null;
    hasAutoRevealedQuestion.value = false;
  }

  return {
    socket,
    session,
    myTeam,
    myMember,
    selectedAnswerIndex,
    answerResult,
    answerStats,
    answersReceived,
    totalActivePlayers,
    teammatePicks,
    teamSyncBonusAwarded,
    sessionLoading,
    sessionError,
    autoReveal,
    timeRemaining,
    isInLobby,
    isQuestionActive,
    isQuestionResult,
    isEnded,
    rankedTeams,
    loadHostSettings,
    toggleAutoReveal,
    initSocket,
    submitAnswer,
    hostStartGame,
    hostAddPlayer,
    hostRemovePlayer,
    hostSetTeamCount,
    hostRandomizeTeams,
    hostShowResult,
    hostNextQuestion,
    hostEndGame,
    leaveSession
  };
});

