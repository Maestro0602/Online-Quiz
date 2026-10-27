import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { User, UserRole } from '@quizchaos/shared';

const STORAGE_KEY = 'quizchaos_user';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const demoUsers = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Initialize from localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      user.value = parsed.user;
      token.value = parsed.token;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const isAuthenticated = computed(() => !!user.value);
  const isInstructor = computed(() => user.value?.role === 'instructor');
  const isStudent = computed(() => user.value?.role === 'student');

  async function fetchDemoUsers() {
    try {
      const res = await fetch('/api/auth/demo-users');
      if (res.ok) {
        const data = await res.json();
        demoUsers.value = data.users;
      }
    } catch (err) {
      console.warn('Failed to load demo users', err);
    }
  }

  async function login(email: string, password = 'password123') {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      user.value = data.user;
      token.value = data.token;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.user, token: data.token }));
      return true;
    } catch (err: any) {
      error.value = err.message || 'An error occurred during login';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(name: string, email: string, role: UserRole, password = 'password123', avatar?: string) {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, password, avatar })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      user.value = data.user;
      token.value = data.token;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.user, token: data.token }));
      return true;
    } catch (err: any) {
      error.value = err.message || 'An error occurred during registration';
      return false;
    } finally {
      loading.value = false;
    }
  }

  function quickSwitchUser(targetUser: User) {
    user.value = targetUser;
    token.value = `mock-token-${targetUser.id}`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: targetUser, token: token.value }));
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    user,
    token,
    demoUsers,
    loading,
    error,
    isAuthenticated,
    isInstructor,
    isStudent,
    login,
    register,
    quickSwitchUser,
    logout,
    fetchDemoUsers
  };
});

