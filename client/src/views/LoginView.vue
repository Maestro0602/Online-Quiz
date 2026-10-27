<template>
  <div class="login-page">
    <div class="login-card animate-pop">
      <div class="header-section">
        <div class="kahoot-logo-big">
          <h1>qiuizez</h1>
        </div>
        <p class="tagline">Sign in to host live battles or join the game</p>
      </div>

      <!-- Quick Demo Account Pickers -->
      <div class="demo-switch-box">
        <div class="demo-title">Quick 1-Click Demo Login</div>
        <div class="demo-group">
          <span class="demo-label">Instructors:</span>
          <div class="demo-buttons">
            <button
              v-for="u in instructors"
              :key="u.id"
              @click="quickLogin(u)"
              class="btn-demo-pill instructor"
            >
              {{ u.name }}
            </button>
          </div>
        </div>

        <div class="demo-group">
          <span class="demo-label">Students:</span>
          <div class="demo-buttons">
            <button
              v-for="u in students"
              :key="u.id"
              @click="quickLogin(u)"
              class="btn-demo-pill student"
            >
              {{ u.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs: Sign In / Register -->
      <div class="tabs">
        <button
          :class="['tab-btn', { active: mode === 'login' }]"
          @click="mode = 'login'"
        >
          Sign In
        </button>
        <button
          :class="['tab-btn', { active: mode === 'register' }]"
          @click="mode = 'register'"
        >
          Create Account
        </button>
      </div>

      <!-- Error Alert -->
      <div v-if="authStore.error" class="error-banner">
        Notice: {{ authStore.error }}
      </div>

      <!-- Login Form -->
      <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="form-body">
        <div class="form-group">
          <label>Email Address</label>
          <input
            v-model="email"
            type="email"
            placeholder="e.g. ada@university.edu"
            required
            class="input-kahoot"
          />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            class="input-kahoot"
          />
        </div>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="btn-kahoot btn-primary btn-block"
        >
          <span v-if="authStore.loading">Signing in...</span>
          <span v-else>Let's Play</span>
        </button>
      </form>

      <!-- Register Form -->
      <form v-else @submit.prevent="handleRegister" class="form-body">
        <div class="form-group">
          <label>Full Name / Nickname</label>
          <input
            v-model="name"
            type="text"
            placeholder="e.g. Sarah Connor"
            required
            class="input-kahoot"
          />
        </div>

        <div class="form-group">
          <label>Email Address</label>
          <input
            v-model="email"
            type="email"
            placeholder="e.g. sarah@school.edu"
            required
            class="input-kahoot"
          />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            class="input-kahoot"
          />
        </div>

        <div class="form-group">
          <label>Role</label>
          <div class="role-selector">
            <label class="role-option" :class="{ selected: role === 'student' }">
              <input type="radio" v-model="role" value="student" />
              <span class="role-text">Student</span>
            </label>
            <label class="role-option" :class="{ selected: role === 'instructor' }">
              <input type="radio" v-model="role" value="instructor" />
              <span class="role-text">Instructor</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="btn-kahoot btn-yellow btn-block"
        >
          <span v-if="authStore.loading">Creating Account...</span>
          <span v-else>Join the Game</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { User, UserRole } from '@quizchaos/shared';

const router = useRouter();
const authStore = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const name = ref('');
const email = ref('ada@university.edu');
const password = ref('password123');
const role = ref<UserRole>('instructor');

const instructors = computed(() =>
  authStore.demoUsers.filter(u => u.role === 'instructor')
);
const students = computed(() =>
  authStore.demoUsers.filter(u => u.role === 'student')
);

async function quickLogin(targetUser: User) {
  authStore.quickSwitchUser(targetUser);
  if (targetUser.role === 'instructor') {
    router.push('/instructor');
  } else {
    router.push('/');
  }
}

async function handleLogin() {
  const success = await authStore.login(email.value, password.value);
  if (success) {
    if (authStore.isInstructor) {
      router.push('/instructor');
    } else {
      router.push('/');
    }
  }
}

async function handleRegister() {
  const success = await authStore.register(name.value, email.value, role.value, password.value);
  if (success) {
    if (authStore.isInstructor) {
      router.push('/instructor');
    } else {
      router.push('/');
    }
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  flex: 1;
}

.login-card {
  background: #ffffff;
  color: #333333;
  width: 100%;
  max-width: 460px;
  border-radius: 16px;
  padding: 32px 28px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
}

.header-section {
  text-align: center;
  margin-bottom: 24px;
}

.kahoot-logo-big {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.kahoot-logo-big .icon {
  font-size: 2.2rem;
}

.kahoot-logo-big h1 {
  font-size: 2.4rem;
  font-weight: 800;
  color: #46178f;
  margin: 0;
}

.kahoot-logo-big h1 span {
  color: #ffa602;
}

.tagline {
  color: #666;
  font-size: 0.95rem;
  margin-top: 6px;
  font-weight: 500;
}

.demo-switch-box {
  background: #f8f6fc;
  border: 2px dashed #864cbf;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 20px;
}

.demo-title {
  font-weight: 700;
  font-size: 0.85rem;
  color: #46178f;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.demo-group {
  margin-bottom: 8px;
}

.demo-group:last-child {
  margin-bottom: 0;
}

.demo-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #777;
  display: block;
  margin-bottom: 4px;
}

.demo-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.btn-demo-pill {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid #ccc;
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-demo-pill.instructor:hover {
  background: #ffa602;
  color: white;
  border-color: #ffa602;
}

.btn-demo-pill.student:hover {
  background: #26890c;
  color: white;
  border-color: #26890c;
}

.tabs {
  display: flex;
  border-bottom: 2px solid #eaeaea;
  margin-bottom: 20px;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  font-family: inherit;
  font-size: 1.05rem;
  font-weight: 700;
  color: #888;
  padding: 10px;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}

.tab-btn.active {
  color: #46178f;
  border-bottom-color: #46178f;
}

.error-banner {
  background: #ffe3e6;
  border: 1px solid #e21b3c;
  color: #e21b3c;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.input-kahoot {
  font-family: inherit;
  font-size: 1rem;
  padding: 12px 14px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.input-kahoot:focus {
  border-color: #46178f;
}

.role-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s ease;
}

.role-option input {
  display: none;
}

.role-option.selected {
  border-color: #46178f;
  background: #f1e9ff;
  color: #46178f;
}

.role-emoji {
  font-size: 1.3rem;
}

.btn-block {
  width: 100%;
  margin-top: 8px;
}
</style>

