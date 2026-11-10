<template>
  <div class="home-page">
    <div class="home-card card-kahoot animate-pop">
      <div class="brand-hero">
        <h1 class="hero-title">qiuizez</h1>
        <p class="hero-tagline">Enter room PIN to join your team battle</p>
      </div>

      <!-- Error Alert -->
      <div v-if="errorMessage" class="error-banner animate-pop">
        Notice: {{ errorMessage }}
      </div>

      <!-- PIN Input Form -->
      <form @submit.prevent="handleJoin" class="join-form">
        <!-- Student Nickname / Auth Status -->
        <div v-if="!authStore.isAuthenticated" class="student-input-group">
          <label class="input-label">Your Nickname</label>
          <input
            v-model="guestNickname"
            type="text"
            placeholder="e.g. PlayerOne"
            required
            maxlength="20"
            class="input-kahoot-large input-nick"
          />
        </div>
        <div v-else class="authenticated-student-pill">
          <span class="auth-avatar">{{ authStore.user?.avatar || authStore.user?.name.substring(0, 2).toUpperCase() }}</span>
          <div class="auth-details">
            <span class="auth-label">Ready to play as</span>
            <strong>{{ authStore.user?.name }}</strong>
          </div>
          <button type="button" @click="authStore.logout()" class="btn-change">
            Change
          </button>
        </div>

        <!-- Room PIN Code -->
        <div class="pin-input-group">
          <input
            v-model="roomCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            placeholder="Game PIN"
            required
            class="input-kahoot-large input-pin"
            autocomplete="off"
            autofocus
          />
        </div>

        <button
          type="submit"
          :disabled="joining || !roomCode"
          class="btn-kahoot btn-primary btn-enter-game"
        >
          <span v-if="joining">Entering Room...</span>
          <span v-else>Enter Room</span>
        </button>
      </form>

      <!-- Host Action -->
      <div class="host-shortcut">
        <router-link to="/instructor" class="btn-kahoot btn-host">
          Host
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { sessionMockService } from '../services/mockApi';
import { User } from '@quizchaos/shared';

const router = useRouter();
const authStore = useAuthStore();

const roomCode = ref('739218');
const guestNickname = ref('');
const joining = ref(false);
const errorMessage = ref<string | null>(null);

async function handleJoin() {
  const pin = roomCode.value.trim().replace(/\s+/g, '');
  if (!pin || !/^\d{6}$/.test(pin)) {
    errorMessage.value = 'Please enter a valid 6-digit numeric Game PIN (e.g. 739218).';
    return;
  }

  // Ensure student has a profile
  if (!authStore.isAuthenticated) {
    if (!guestNickname.value.trim() || guestNickname.value.trim().length < 2) {
      errorMessage.value = 'Please enter a nickname (at least 2 characters) or sign in.';
      return;
    }
    const initials = guestNickname.value.trim().substring(0, 2).toUpperCase();
    const guestUser: User = {
      id: `stud-${Date.now()}`,
      name: guestNickname.value.trim(),
      email: `${guestNickname.value.toLowerCase().replace(/\s+/g, '')}@student.local`,
      role: 'student',
      avatar: initials
    };
    authStore.quickSwitchUser(guestUser);
  }

  joining.value = true;
  errorMessage.value = null;

  try {
    const data = await sessionMockService.joinSession(
      pin,
      authStore.user!.id,
      authStore.user!.name,
      authStore.user!.avatar
    );

    // Save joined session info
    sessionStorage.setItem(`session_${pin}_team`, JSON.stringify(data.team));
    sessionStorage.setItem(`session_${pin}_member`, JSON.stringify(data.member));

    router.push(`/play/${pin}`);
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not join room. Check PIN and try again.';
  } finally {
    joining.value = false;
  }
}
</script>

<style scoped>
.home-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  flex: 1;
}

.home-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 18px;
  padding: 36px 28px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  text-align: center;
}

.brand-hero {
  margin-bottom: 24px;
}

.hero-shapes {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 8px;
}

.shape-dot {
  font-size: 1.2rem;
  font-weight: 900;
}

.shape-dot.red { color: var(--kahoot-red); }
.shape-dot.blue { color: var(--kahoot-blue); }
.shape-dot.yellow { color: var(--kahoot-yellow); }
.shape-dot.green { color: var(--kahoot-green); }

.hero-title {
  font-size: 2.6rem;
  font-weight: 800;
  color: var(--theme-card-text);
  margin: 0;
  letter-spacing: -0.5px;
}

.hero-tagline {
  color: var(--theme-card-text);
  opacity: 0.8;
  font-weight: 600;
  font-size: 0.95rem;
  margin-top: 6px;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.input-label {
  display: block;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--theme-card-text);
  text-align: left;
  margin-bottom: 4px;
}

.input-kahoot-large {
  width: 100%;
  padding: 14px 18px;
  font-family: inherit;
  font-size: 1.3rem;
  font-weight: 800;
  text-align: center;
  border: 1.5px solid var(--theme-card-border);
  border-radius: 10px;
  outline: none;
  background: transparent;
  color: var(--theme-card-text);
  transition: border-color 0.2s;
}

.input-pin {
  letter-spacing: 4px;
  font-size: 1.6rem;
}

.input-pin:focus, .input-nick:focus {
  border-color: var(--theme-card-text);
}

.btn-enter-game {
  width: 100%;
  padding: 16px;
  font-size: 1.2rem;
  border-radius: 10px;
}

.authenticated-student-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: 1.5px solid var(--theme-card-border);
  border-radius: 10px;
  padding: 10px 14px;
  text-align: left;
}

.auth-avatar {
  font-size: 1.8rem;
}

.auth-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.auth-label {
  font-size: 0.75rem;
  color: var(--theme-card-text);
  opacity: 0.7;
  font-weight: 700;
}

.auth-details strong {
  color: var(--theme-card-text);
  font-size: 1.05rem;
}

.btn-change {
  background: none;
  border: none;
  color: var(--theme-card-text);
  font-weight: 800;
  cursor: pointer;
  font-size: 0.85rem;
  text-decoration: underline;
}

.host-shortcut {
  border-top: 1px solid var(--theme-card-border);
  padding-top: 16px;
}

.btn-host {
  width: 100%;
  padding: 12px;
  font-size: 1.1rem;
  background-color: var(--theme-card-bg);
  color: var(--theme-card-text);
  border: 1.5px solid var(--theme-card-border);
  box-shadow: 0 4px 0 var(--theme-card-border);
}

.btn-host:hover {
  background-color: var(--theme-card-border);
  color: var(--theme-card-bg);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.25);
}

.btn-host:active {
  box-shadow: 0 2px 0 var(--theme-card-border);
}

.error-banner {
  background: #ffe3e6;
  border: 2px solid #e21b3c;
  color: #e21b3c;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  margin-bottom: 16px;
  font-size: 0.9rem;
}
</style>

