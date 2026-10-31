<template>
  <div class="app-layout">
    <!-- Kahoot Header Navigation -->
    <header class="kahoot-navbar">
      <div class="nav-container">
        <router-link to="/" class="brand-logo">
          <span class="logo-text">qiuizez</span>
        </router-link>

        <nav class="nav-links">
          <router-link to="/" class="nav-item" active-class="nav-active">
            Join Game
          </router-link>

          <template v-if="authStore.isInstructor">
            <router-link to="/instructor" class="nav-item" active-class="nav-active">
              Instructor Dashboard
            </router-link>
            <router-link to="/instructor/quiz/new" class="nav-item btn-nav-action">
              + New Quiz
            </router-link>
          </template>

          <template v-if="authStore.isAuthenticated">
            <div class="user-pill">
              <span class="user-avatar">{{ authStore.user?.avatar || authStore.user?.name.substring(0, 2).toUpperCase() }}</span>
              <div class="user-info">
                <span class="user-name">{{ authStore.user?.name }}</span>
                <span class="user-role-badge" :class="authStore.user?.role">
                  {{ authStore.user?.role }}
                </span>
              </div>
              <button @click="handleLogout" class="btn-logout" title="Sign out">
                Logout
              </button>
            </div>
          </template>
          <template v-else>
            <router-link to="/login" class="btn-kahoot btn-primary btn-sm">
              Sign In
            </router-link>
          </template>

          <!-- Theme Switcher -->
          <div class="theme-dropdown">
            <button
              type="button"
              class="theme-toggle-btn"
              @click="isDropdownOpen = !isDropdownOpen"
              aria-label="Select Theme"
            >
              <span>{{ currentThemeLabel }}</span>
              <span class="dropdown-arrow" :class="{ open: isDropdownOpen }">▼</span>
            </button>
            <div v-if="isDropdownOpen" class="theme-menu">
              <button
                v-for="t in themes"
                :key="t.value"
                type="button"
                class="theme-menu-item"
                :class="{ active: currentTheme === t.value }"
                @click="selectTheme(t.value)"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>

    <!-- Main View Outlet -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="kahoot-footer">
      <p>qiuizez • Collaborative Team Quiz Platform</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();
const router = useRouter();

const currentTheme = ref(localStorage.getItem('app_theme') || 'ocean');
const isDropdownOpen = ref(false);

const themes = [
  { value: 'ocean', label: 'Ocean (Default)' },
  { value: 'sage', label: 'Sage Green' },
  { value: 'monochrome', label: 'Black & White' },
  { value: 'classic', label: 'Classic Purple' }
];

const currentThemeLabel = computed(() => {
  const found = themes.find(t => t.value === currentTheme.value);
  return found ? found.label : 'Select Theme';
});

function applyTheme(theme: string) {
  currentTheme.value = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('app_theme', theme);
}

function selectTheme(theme: string) {
  applyTheme(theme);
  isDropdownOpen.value = false;
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.theme-dropdown')) {
    isDropdownOpen.value = false;
  }
}

onMounted(() => {
  applyTheme(currentTheme.value);
  authStore.fetchDemoUsers();
  document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--theme-bg-gradient);
  color: #ffffff;
  transition: background 0.3s ease;
}

.kahoot-navbar {
  background-color: var(--theme-navbar-bg);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  padding: 12px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background-color 0.3s ease;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.brand-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: var(--theme-logo);
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.logo-text {
  color: var(--theme-logo);
}

.logo-badge {
  font-size: 0.65rem;
  background-color: #e21b3c;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-left: 4px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-item {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-item:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.nav-active {
  color: white;
  background: rgba(255, 255, 255, 0.18);
}

.btn-nav-action {
  background-color: var(--theme-button-primary);
  color: var(--theme-button-text);
  border: 1px solid var(--theme-card-border);
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.95rem;
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.15);
  padding: 6px 14px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-avatar {
  font-size: 1.4rem;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 700;
  font-size: 0.9rem;
}

.user-role-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.user-role-badge.instructor {
  color: var(--theme-logo);
}

.user-role-badge.student {
  color: var(--theme-accent);
}

.btn-logout {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-weight: 800;
  font-size: 1rem;
  padding: 2px 6px;
  border-radius: 50%;
  transition: color 0.2s, background 0.2s;
}

.btn-logout:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
}

.theme-dropdown {
  position: relative;
}

.theme-toggle-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: transparent;
  color: var(--theme-logo);
  border: 1.5px solid var(--theme-card-border);
  padding: 6px 14px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.theme-toggle-btn:hover {
  border-color: var(--theme-logo);
}

.dropdown-arrow {
  font-size: 0.6rem;
  transition: transform 0.2s ease;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.theme-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background-color: var(--theme-navbar-bg);
  border: 1.5px solid var(--theme-card-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 200;
}

.theme-menu-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--theme-logo);
  padding: 10px 14px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.theme-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.theme-menu-item.active {
  background-color: var(--theme-card-border);
  color: var(--theme-card-bg);
  font-weight: 700;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.kahoot-footer {
  text-align: center;
  padding: 16px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
</style>

