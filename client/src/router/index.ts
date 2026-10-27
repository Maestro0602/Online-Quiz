import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/LoginView.vue';
import InstructorDashboardView from '../views/InstructorDashboardView.vue';
import QuizEditorView from '../views/QuizEditorView.vue';
import HostGameView from '../views/HostGameView.vue';
import StudentGameView from '../views/StudentGameView.vue';
import SummaryView from '../views/SummaryView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/instructor',
      name: 'instructor-dashboard',
      component: InstructorDashboardView
    },
    {
      path: '/instructor/quiz/new',
      name: 'quiz-new',
      component: QuizEditorView
    },
    {
      path: '/instructor/quiz/:id/edit',
      name: 'quiz-edit',
      component: QuizEditorView
    },
    {
      path: '/instructor/session/:roomCode',
      name: 'host-game',
      component: HostGameView
    },
    {
      path: '/play/:roomCode',
      name: 'student-game',
      component: StudentGameView
    },
    {
      path: '/summary/:roomCode',
      name: 'game-summary',
      component: SummaryView
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
});

export default router;
