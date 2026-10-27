<template>
  <div class="summary-page">
    <div class="summary-container" v-if="summaryData">
      <!-- Header Banner -->
      <div class="summary-header card-kahoot animate-pop">
        <div class="header-content">
          <span class="summary-badge">Official Match Report</span>
          <h1>{{ summaryData.quiz_title }}</h1>
          <div class="stats-row">
            <span class="stat-tag">🎯 Room PIN: {{ summaryData.room_code }}</span>
            <span class="stat-tag">👥 {{ summaryData.total_participants }} Total Participants</span>
            <span class="stat-tag">🏆 {{ summaryData.teams.length }} Competing Teams</span>
          </div>
        </div>

        <div class="header-actions">
          <button @click="celebrateConfetti" class="btn-kahoot btn-yellow btn-sm">
            🎉 Confetti
          </button>
          <router-link to="/" class="btn-kahoot btn-white btn-sm">
            Play Again
          </router-link>
          <router-link
            v-if="authStore.isInstructor"
            to="/instructor"
            class="btn-kahoot btn-primary btn-sm"
          >
            Dashboard
          </router-link>
        </div>
      </div>

      <!-- Final Team Podium Standings -->
      <div class="podium-section card-kahoot animate-pop">
        <h2>🏆 Final Team Standings</h2>
        <div class="team-rank-cards">
          <div
            v-for="(team, idx) in summaryData.teams"
            :key="team.id"
            class="team-summary-card"
            :style="{ borderColor: team.color }"
          >
            <div class="team-rank-header" :style="{ backgroundColor: team.color }">
              <span class="rank-pos">#{{ idx + 1 }}</span>
              <span class="rank-badge-icon">{{ team.badge }}</span>
              <span class="rank-team-name">{{ team.name }}</span>
              <span class="rank-points">{{ team.total_score.toLocaleString() }} pts</span>
            </div>

            <!-- Team Members & Contributions -->
            <div class="team-roster">
              <div class="roster-title">Team Contributors:</div>
              <div v-if="team.members.length === 0" class="no-members">
                No members joined
              </div>
              <div
                v-for="(member, mIdx) in sortedMembers(team.members)"
                :key="member.id"
                class="roster-member-row"
              >
                <div class="member-left">
                  <span class="mvp-star" v-if="mIdx === 0 && member.individual_score > 0" title="Team MVP">
                    ⭐ MVP
                  </span>
                  <span class="m-avatar">{{ member.avatar || '🦊' }}</span>
                  <span class="m-name">{{ member.user_name }}</span>
                </div>
                <div class="member-score">
                  {{ member.individual_score.toLocaleString() }} pts
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Individual Contributors (Story 7) -->
      <div class="mvp-section card-kahoot animate-pop">
        <h2>⭐ Top Individual Contributors (MVPs)</h2>
        <p class="section-sub">Highest scoring students across all teams:</p>

        <div class="mvp-list" v-if="summaryData.top_contributors.length > 0">
          <div
            v-for="(contrib, index) in summaryData.top_contributors"
            :key="contrib.user_id"
            class="mvp-card"
          >
            <div class="mvp-rank-pill" :class="'mvp-' + (index + 1)">
              {{ index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}` }}
            </div>
            <div class="mvp-info">
              <strong class="mvp-name">{{ contrib.user_name }}</strong>
              <span class="mvp-team" :style="{ color: contrib.team_color }">
                Team {{ contrib.team_name }}
              </span>
            </div>
            <div class="mvp-score">
              {{ contrib.score.toLocaleString() }} pts
            </div>
          </div>
        </div>
        <div v-else class="empty-contributors">
          No individual scores recorded for this session.
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else class="loading-box card-kahoot">
      <div class="spinner"></div>
      <p>Loading match summary...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { GameSummary, TeamMember } from '@quizchaos/shared';
import confetti from 'canvas-confetti';

const route = useRoute();
const authStore = useAuthStore();

const summaryData = ref<GameSummary | null>(null);

onMounted(async () => {
  const roomCode = route.params.roomCode as string;
  try {
    const res = await fetch(`/api/sessions/${roomCode}/summary`);
    if (res.ok) {
      summaryData.value = await res.json();
      celebrateConfetti();
    }
  } catch (err) {
    console.error('Failed to load summary', err);
  }
});

function sortedMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => b.individual_score - a.individual_score);
}

function celebrateConfetti() {
  try {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.55 }
    });
  } catch {}
}
</script>

<style scoped>
.summary-page {
  padding: 30px 16px 80px;
  flex: 1;
}

.summary-container {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.summary-badge {
  display: inline-block;
  background: #f1e9ff;
  color: #46178f;
  font-weight: 800;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 14px;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.header-content h1 {
  font-size: 2rem;
  font-weight: 900;
  color: #222;
  margin-bottom: 8px;
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stat-tag {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #555;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.podium-section h2, .mvp-section h2 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #46178f;
  margin-bottom: 16px;
}

.section-sub {
  color: #666;
  font-size: 0.9rem;
  margin-top: -10px;
  margin-bottom: 16px;
}

.team-rank-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.team-summary-card {
  border: 3px solid;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.team-rank-header {
  color: white;
  padding: 12px 16px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rank-pos {
  font-size: 1.2rem;
}

.rank-badge-icon {
  font-size: 1.4rem;
}

.rank-team-name {
  flex: 1;
  font-size: 1.1rem;
}

.rank-points {
  font-size: 1.15rem;
  font-weight: 900;
}

.team-roster {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.roster-title {
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 800;
  color: #888;
}

.no-members {
  color: #999;
  font-style: italic;
  font-size: 0.85rem;
}

.roster-member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9f9f9;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.member-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mvp-star {
  background: #fff3cd;
  color: #856404;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 10px;
}

.m-avatar {
  font-size: 1.2rem;
}

.m-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #333;
}

.member-score {
  font-weight: 800;
  font-size: 0.95rem;
  color: #46178f;
}

/* MVP LIST */
.mvp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mvp-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
  border-radius: 10px;
  background: #f9f9f9;
  border: 1px solid #eaeaea;
}

.mvp-rank-pill {
  font-weight: 900;
  font-size: 1rem;
  width: 75px;
}

.mvp-1 { color: #d4af37; }
.mvp-2 { color: #888888; }
.mvp-3 { color: #cd7f32; }

.mvp-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mvp-name {
  font-size: 1.1rem;
  color: #222;
}

.mvp-team {
  font-size: 0.85rem;
  font-weight: 700;
}

.mvp-score {
  font-size: 1.2rem;
  font-weight: 900;
  color: #26890c;
}

.loading-box {
  text-align: center;
  padding: 60px;
  max-width: 400px;
  margin: 60px auto;
}
</style>
