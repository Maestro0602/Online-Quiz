# M0 & M1 Milestone Report — `qiuizez` Collaborative Team Quiz Prototype

---

## Part 1: M0 Scope, Entities & Product Decisions

### 1.1 MVP Scope: Must-Have vs. Nice-to-Have

#### Must-Have Features (Core MVP)
1. **Role-Based Authentication & Quick Demo Switcher**: Sign in / Register as an `instructor` (`teacher`) or `student` (`user`), plus 1-click demo switching for rapid prototype evaluation.
2. **Instructor Quiz Dashboard & CRUD Editor**: View all created quizzes, create new quizzes, edit existing quizzes (`/instructor/quiz/:id/edit`), toggle publish status, and delete quizzes.
3. **4-Shape Question Builder with Client-Side Validation**: Configure question prompt, time limit (`10s`–`60s`), base points (`500`–`2000`), 4 Kahoot-style shape options (`▲ Red`, `◆ Blue`, `● Yellow`, `■ Green`), and radio selection for the correct answer.
4. **Live Room PIN Generation & Auto-Balanced Team Lobby**: Launch a quiz session with 2 to 4 teams (`Red Rockets`, `Blue Blasters`, `Golden Geeks`, `Green Giants`) and a 6-digit numeric Room PIN (`739218`).
5. **Interactive Gameplay & Post-Game Podium Summary**: Host question projection view, Student 4-shape touch gamepad, speed-based team scoring, and final Podium + Top Individual Contributors (`MVPs`) report.

#### Nice-to-Have Features (Post-MVP / Secondary)
1. **4-Theme Live CSS Variable Switcher**: Instant theme switching between `Ocean (Default)`, `Sage Green`, `Black & White (Monochrome)`, and `Classic Purple` persisted in `localStorage`.
2. **Synthesized Web Audio API Sound Effects**: Zero-dependency oscillator sound effects (`playTick`, `playCorrect`, `playWrong`, `playFanfare`) generated directly in the browser.
3. **Confetti Podium Celebration**: Canvas particle burst triggered when the final team standings are revealed.

---

### 1.2 Entity List, Attributes & Relations (4 Core Entities)

```
┌──────────────────┐       1 : N       ┌──────────────────┐       1 : N       ┌──────────────────┐
│       User       │ ────────────────► │       Quiz       │ ────────────────► │     Question     │
├──────────────────┤                   ├──────────────────┤                   ├──────────────────┤
│ id (PK)          │                   │ id (PK)          │                   │ id (PK)          │
│ name             │                   │ instructor_id(FK)│                   │ quiz_id (FK)     │
│ email            │                   │ title            │                   │ prompt           │
│ role             │                   │ description      │                   │ options [4]      │
│ avatar           │                   │ is_published     │                   │ correct_option   │
└──────────────────┘                   │ created_at       │                   │ time_limit_sec   │
         │                             └──────────────────┘                   │ base_points      │
         │                                      │                             └──────────────────┘
         │                                      │ 1 : N
         │                                      ▼
         │                             ┌──────────────────┐       1 : N       ┌──────────────────┐
         │                             │   GameSession    │ ────────────────► │       Team       │
         │                             ├──────────────────┤                   ├──────────────────┤
         │                             │ id (PK)          │                   │ id (PK)          │
         │                             │ quiz_id (FK)     │                   │ session_id (FK)  │
         └────────── Joins via ──────► │ room_code (PIN)  │                   │ name, color      │
                     TeamMember        │ status           │                   │ badge            │
                                       │ team_count       │                   │ total_score      │
                                       │ current_q_index  │                   │ members[]        │
                                       └──────────────────┘                   └──────────────────┘
```

| Entity | Main Attributes | Relationships |
| :--- | :--- | :--- |
| **1. `User`** | `id: string`, `name: string`, `email: string`, `role: 'instructor' \| 'teacher' \| 'student' \| 'user'`, `avatar?: string` | **1-to-Many** with `Quiz` (an instructor owns multiple quizzes); **Many-to-Many** with `GameSession` via `TeamMember`. |
| **2. `Quiz`** | `id: string`, `instructor_id: string`, `title: string`, `description: string`, `is_published: boolean`, `created_at: string`, `questions: Question[]` | Belongs to **1 `User`** (`instructor_id`); contains **1-to-Many `Question`** items; spawns **1-to-Many `GameSession`** rooms. |
| **3. `Question`** | `id: string`, `quiz_id: string`, `prompt: string`, `options: [string, string, string, string]`, `correct_option_index: number`, `time_limit_seconds: number`, `base_points: number`, `order_index: number` | Belongs to **1 `Quiz`** (`quiz_id`). |
| **4. `GameSession` & `Team`** | `id: string`, `quiz_id: string`, `room_code: string`, `status: 'lobby' \| 'question_active' \| 'question_result' \| 'ended'`, `team_count: number`, `teams: Team[]` (`id`, `name`, `color`, `badge`, `total_score`, `members: TeamMember[]`) | References **1 `Quiz`** (`quiz_id`); contains **2 to 4 `Team`** objects, each holding **Many `TeamMember`** records. |

---

### 1.3 Chosen Stretch Feature

* **Stretch Feature Name**: **Interactive Team Picker Spin Wheel & Real-Time Collaborative Team Balancing**
* **Description**: In the Host Lobby (`HostGameView.vue`), the instructor has a dedicated side-by-side **Team Picker Wheel** with a central `START` spin hub alongside an `INPUTS [N]` roster of connected students. Clicking `START` spins the 4-color wheel (`cubic-bezier(0.15, 0.9, 0.2, 1)`) with synthesized audio ticks and executes a Fisher–Yates shuffle to redistribute all connected students evenly across teams before starting the 3-second countdown.

---

### 1.4 Rubric Question: Which Story Did You Cut from the MVP, and Why?

* **Story Cut from the MVP**: **Live Per-Question Team Chat & Power-Up Sabotage Cards ("Freeze Opponent Screen" / "Double Team Streak Shield")**.
* **Why We Cut It**:
  1. **Cognitive Overload Under Time Pressure**: Each quiz question has a short `15s`–`20s` countdown timer. During early paper prototyping, we realized that forcing students on mobile phones to type chat messages *and* select power-up targets while simultaneously reading the host screen and tapping one of the 4 geometric answer buttons caused severe UI clutter and missed answers.
  2. **Scope & State Complexity**: Adding a real-time chat moderation queue and cross-team sabotage state effects would have doubled the number of state transitions per round without improving the core learning goal. Cutting in-round chat and sabotage power-ups allowed us to focus 100% on a rock-solid **Team Picker Spin Wheel**, **Speed-Bonus Team Scoring**, and **Individual MVP Attribution** on the final podium.

---

## Part 2: M1 Frontend Prototype Checklist & Architecture (Week 5)

### 2.1 M1 Requirements Verification

| M1 Checklist Item | Implementation in This Repository |
| :--- | :--- |
| **Wireframes in `docs/`** | Complete SVG wireframes of all 8 screens + 4-theme design system in [`docs/wireframes/`](./wireframes/README.md) (`00_theme_and_design_system.svg` through `08_summary_podium.svg` and `all_screens_wireframe.svg`). |
| **Vue 3 + TypeScript + Vite (`strict: true`, ESLint passes)** | Configured in [`client/tsconfig.json`](../client/tsconfig.json) (`"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`) and [`client/.eslintrc.cjs`](../client/.eslintrc.cjs). Verified with `npm run lint` and `npm run build`. |
| **At least 4 routes, including a detail page with a route parameter** | **7 routes** defined in [`client/src/router/index.ts`](../client/src/router/index.ts), including **4 parameterized detail routes**: `/instructor/quiz/:id/edit`, `/instructor/session/:roomCode`, `/play/:roomCode`, and `/summary/:roomCode`. |
| **At least one form with client-side validation** | Implemented in [`QuizEditorView.vue`](../client/src/views/QuizEditorView.vue) (validates non-empty quiz title, minimum 1 question, non-empty question prompts, all 4 answer options filled, and valid correct answer index), [`LoginView.vue`](../client/src/views/LoginView.vue) (email format, password length, role selection), and [`HomeView.vue`](../client/src/views/HomeView.vue) (6-digit numeric PIN regex `/^\d{6}$/` and nickname length). |
| **Pinia store + Service layer calling a mock API (local JSON)** | Local seed JSON in [`client/src/data/mockDb.json`](../client/src/data/mockDb.json), async service layer in [`client/src/services/mockApi.ts`](../client/src/services/mockApi.ts) (`authMockService`, `quizMockService`, `sessionMockService`), consumed by Pinia stores [`auth.ts`](../client/src/stores/auth.ts), [`quiz.ts`](../client/src/stores/quiz.ts), and [`game.ts`](../client/src/stores/game.ts). |
| **Loading, empty, and error states visible** | Implemented in [`InstructorDashboardView.vue`](../client/src/views/InstructorDashboardView.vue) with a built-in **M1 UI State Inspector Toolbar** at the top of the dashboard allowing 1-click live toggling of **Loading State**, **Empty State**, **Error State**, and **Reset Mock JSON**. |

---

### 2.2 Rubric Question: What State Lives in the Pinia Store and What Stays Inside a Component? Why?

#### 1. State That Lives in Pinia Stores (`client/src/stores/`)
* **`useAuthStore` (`auth.ts`)**: `user`, `token`, `demoUsers`, `isAuthenticated`, `isInstructor`, `isStudent`, `loading`, `error`.
  * **Why**: Authentication identity and role permissions must be read globally by the top navigation bar (`App.vue`), route guards, the Instructor Dashboard (`InstructorDashboardView.vue`), and the Student Lobby (`HomeView.vue` / `StudentGameView.vue`).
* **`useQuizStore` (`quiz.ts`)**: `quizzes`, `currentQuiz`, `loading`, `error`, and CRUD actions (`fetchQuizzes`, `fetchQuizById`, `createQuiz`, `updateQuiz`, `deleteQuiz`, `togglePublish`).
  * **Why**: The quiz catalog is shared between the Instructor Dashboard list view and the parameterized Quiz Editor detail view (`/instructor/quiz/:id/edit`). Keeping `quizzes` in Pinia ensures that creating, editing, or toggling publish status in one route immediately reflects in the dashboard without stale cache bugs.
* **`useGameStore` (`game.ts`)**: `session`, `myTeam`, `myMember`, `selectedAnswerIndex`, `answerResult`, `answerStats`, `timeRemaining`, `rankedTeams`.
  * **Why**: Live game state drives 4 separate stages (`lobby` → `question_active` → `question_result` → `ended`) across host and player views and synchronizes across browser tabs via `BroadcastChannel`.

#### 2. State That Stays Local Inside Vue Components (`ref()` in `<script setup>`)
* **`HomeView.vue`**: `roomCode`, `guestNickname`, `joining`, `errorMessage`.
* **`LoginView.vue`**: `mode` (`'login' | 'register'`), `name`, `email`, `password`, `role`.
* **`InstructorDashboardView.vue`**: `showLaunchModal`, `selectedQuiz`, `teamCount`, `launching`, `launchError`.
* **`QuizEditorView.vue`**: Draft `form` object (`title`, `description`, `is_published`, `questions[]`), `validationError`, `successMessage`, `saving`.
* **`HostGameView.vue`**: `isSpinningWheel`, `wheelRotation`, `wheelResultText`, `isStartingCountdown`, `countdownTimer`.
* **Why This State Stays Local**:
  1. **Transient UI & Ephemeral Form Drafts**: Modal open/close flags (`showLaunchModal`), CSS animation angles (`wheelRotation`), and unsaved form input drafts (`QuizEditorView.vue`'s `form`) belong strictly to a single screen's lifecycle. If a user types half a question in `QuizEditorView.vue` and clicks "Back to Dashboard" without saving, keeping the draft local prevents corrupting the global `useQuizStore.quizzes` array.
  2. **Decoupling & Performance**: Polluting global Pinia stores with every keystroke or spinner angle makes DevTools inspection noisy and introduces accidental state bleed when navigating back and forth between routes.

---

## Part 3: Engineering Challenges, Debugging War Stories & Hard Experiences (M1 Development Log)

Below is an honest technical log of the hardest bugs, architectural roadblocks, and debugging sessions we went through while building the M1 prototype.

### Hard Experience #1: Accidental Reference Mutation Between `QuizEditorView.vue` and `mockDb.json`
* **What Happened**: When we first built the parameterized edit page (`/instructor/quiz/:id/edit`), we loaded the quiz from `useQuizStore.fetchQuizById(id)` and assigned `form.value.questions = quiz.questions`. When testing in the browser, we noticed a bizarre bug: if we deleted a question or changed an option's text inside the editor and then clicked **"← Back to Dashboard"** *without* clicking **"Save Quiz"**, the dashboard still showed our unsaved edits!
* **Root Cause**: In JavaScript/TypeScript, assigning an array of objects (`quiz.questions`) copies the *object references*, not a deep clone. Because `v-model="q.options[optIdx]"` mutated the nested array in place, it was directly mutating the object stored inside Pinia and `mockApi.ts` memory before `updateQuiz()` was ever called.
* **How We Fixed It**:
  1. In [`mockApi.ts`](../client/src/services/mockApi.ts) (`getQuizById`), we wrapped the returned quiz in a deep clone (`JSON.parse(JSON.stringify(quiz))`).
  2. In [`QuizEditorView.vue`](../client/src/views/QuizEditorView.vue), we explicitly mapped each question and cloned its 4-tuple options (`options: [...q.options] as [string, string, string, string]`) into the local `form` ref so edits remain 100% isolated until the instructor submits the form.

### Hard Experience #2: Fighting TypeScript `strict: true` on Fixed-Length 4-Option Tuples
* **What Happened**: When we ran `npm run build` (`vue-tsc`) with `"strict": true` enabled in `tsconfig.json`, the compiler threw `TS2322: Type 'string[]' is not assignable to type '[string, string, string, string]'` inside both `QuizEditorView.vue` and `mockApi.ts`.
* **Root Cause**: In `@quizchaos/shared`, `Question.options` is strictly typed as a 4-element tuple `[string, string, string, string]` because every Kahoot question must map to the 4 geometric shapes (`▲`, `◆`, `●`, `■`). However, TypeScript infers array literals like `['', '', '', '']` or `.map()` outputs from `mockDb.json` as generic `string[]` of unknown length.
* **How We Fixed It**: Rather than weakening `tsconfig.json` or disabling strict mode, we enforced a 4-option validation check in `validateForm()` (`q.options.some(opt => !opt.trim())`) and explicitly narrowed the tuple type (`options: [...q.options] as [string, string, string, string]`) when constructing `Question` payloads.

### Hard Experience #3: Overlapping UI Elements in the Host Lobby & SVG Wireframes
* **What Happened**: In our first iteration of the Host Lobby (`HostGameView.vue` and `05_host_lobby.svg`), we placed the `Team Balancer Wheel` as a floating card in the bottom-right corner (`x=765, y=505`). When we imported the SVG wireframes into Figma and tested on a 1280×800 laptop viewport, the floating wheel card clipped right over the `"Start Game Now"` button (`"Start Game No[w]"`).
* **Root Cause**: Mixing centered full-width flex rows (`.lobby-action-row`) with absolutely/fixed positioned floating cards caused bounding-box collisions whenever all 4 teams had student chips rendered.
* **How We Fixed It**: We refactored the entire Stage 1 Host Lobby into a deterministic **2-Column CSS Grid Split Layout** (`.lobby-split-layout` with `grid-template-columns: 1.45fr 1fr; gap: 28px`):
  * **Left Column**: Contains the 2×2 Assigned Teams Board (`Red Rockets`, `Blue Blasters`, `Golden Geeks`, `Green Giants`) and the bottom action bar (`Randomize Teams` + `Start Game Now`).
  * **Right Column**: Contains the always-visible **Team Picker Wheel** (with its center circular `START` button) stacked cleanly above the **`INPUTS [4]`** connected player roster. Zero elements can ever overlap.

### Hard Experience #4: Countdown Timer Speed-Up Bug ("The 3x Turbo Timer")
* **What Happened**: During gameplay testing in `HostGameView.vue`, we noticed that by Question 3, the 20-second countdown timer was ticking down 3 seconds per second!
* **Root Cause**: Every time `startTimer(duration)` was called for a new question, a new `setInterval(..., 1000)` was created without clearing the previous interval if the host clicked `"Skip / Reveal Answer"` early. Multiple intervals were decrementing `timeRemaining.value` simultaneously.
* **How We Fixed It**: We wrote a dedicated `stopTimer()` helper in [`game.ts`](../client/src/stores/game.ts) that checks `if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null; }` and invoked `stopTimer()` at the very first line of `startTimer()`, `hostShowResult()`, `hostEndGame()`, and `leaveSession()`.

### Hard Experience #5: Figma Showing Blank Artboards When Importing Combined SVG Wireframes
* **What Happened**: When we initially generated `all_screens_wireframe.svg` to import all wireframes into Figma at once, Figma imported an empty dark frame with only text headers and blank boxes.
* **Root Cause**: Our first combined SVG used `<image href="01_home_join.svg" />` tags referencing external local files. For security reasons, Figma's SVG importer strips external relative file links when dragging a single `.svg` onto the canvas.
* **How We Fixed It**: We wrote a custom Node.js build script that strips outer `<svg>` wrappers and embeds the raw `<g>` vector paths of all 9 artboards directly inline inside `docs/wireframes/all_screens_wireframe.svg`, making it 100% self-contained.
