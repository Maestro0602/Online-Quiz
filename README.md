# qiuizez - Collaborative Team Quiz Platform

A high-energy, collaborative real-time team quiz platform built with **TypeScript**, **Vue 3 (Vite + Pinia + Vue Router)**, and an **Express + Socket.IO** backend.

---

## Design and Features

- **Iconic 4-Shape Answer Buttons**:
  - ▲ **Red** (Triangle)
  - ◆ **Blue** (Diamond)
  - ● **Yellow** (Circle)
  - ■ **Green** (Square)
- **Deep Theme Background** (`#46178f`) with responsive cards and beveled action buttons.
- **Audio-Visual Effects**: Web Audio API sound synthesis for countdown ticking, correct answer chime, incorrect buzzer, and game celebration fanfare.
- **Podium & Confetti**: 3-tier podium with animated rankings and confetti celebrations on quiz completion.

---

## User Stories Implemented

1. **Instructor Quiz Management (Story 1)**:
   - Create, edit, publish, and delete quizzes.
   - Question editor with 4 colored shape options, base points, timer limits, and correct option picker.
   - Pre-seeded with ready-to-play quizzes.

2. **Session Launch & Automated Team Balancing (Story 2 & 3)**:
   - Instructors select between 2 to 4 teams (*Red Rockets*, *Blue Blasters*, *Golden Geeks*, *Green Giants*).
   - Generates a unique 6-digit room PIN.
   - Joining students are automatically assigned in a balanced round-robin order to teams.

3. **Live Gameplay & Answer Scoring (Story 4 & 5)**:
   - Host screen projects the question prompt, live circular countdown timer, and shape cards.
   - Student screens present touch-friendly answer buttons.
   - Individual student points contribute directly and cumulatively to their team's score.
   - Instant response feedback (points awarded + speed bonus calculation).

4. **Session Control & Post-Game Summary (Story 6 & 7)**:
   - Instructor can advance questions, reveal answer breakdowns, or manually end the session.
   - Comprehensive post-game match report displaying team rankings and individual MVP contributors.

5. **Real-time Synchronization (Stretch Feature)**:
   - Socket.IO over WebSockets with shared TypeScript contracts across client and server.
   - Dynamic real-time lobby updates, question transitions, and live team scoreboards without manual page refreshes.

---

## Demo Accounts (Quick 1-Click Login)

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Instructor** | Prof. Ada Lovelace | `ada@university.edu` | `password123` |
| **Instructor** | Dr. Alan Turing | `alan@university.edu` | `password123` |
| **Student** | Alex Rivera | `alex@student.edu` | `password123` |
| **Student** | Bella Chen | `bella@student.edu` | `password123` |
| **Student** | Carlos Gomez | `carlos@student.edu` | `password123` |
| **Student** | Diana Prince | `diana@student.edu` | `password123` |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode (Runs Server on `:3001` and Vite Client on `:5173`)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build & Start
```bash
npm run build
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## How to Test Multi-Player Locally

1. Open **Tab 1**: Sign in as Instructor (*Prof. Ada Lovelace*), go to Dashboard, click **Launch Game** on any quiz, and select team count.
2. Note the generated **6-digit Room PIN** (e.g., `575007`).
3. Open **Tab 2** (or Incognito window): Go to Home, pick or type a student nickname (*Alex Rivera*), enter the Room PIN, and click **Enter Room**.
4. Open **Tab 3**: Pick another student (*Bella Chen*), enter the Room PIN - see them balanced onto the competing team in real-time.
5. On Tab 1, click **Start Game Now** to begin the live team battle.
