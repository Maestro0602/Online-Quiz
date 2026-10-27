# QuizChaos - Collaborative Team Quiz Platform

## Problem

University instructors struggle to maintain active engagement and teamwork during review sessions because traditional quizzes promote passive, isolated participation. This lack of collaboration leads to student boredom, unequal participation, and lower retention of critical course material.

## Users and roles

- **Instructor (Quiz Creator / Host):** Authenticates into the platform, creates and manages quizzes with questions, launches quiz sessions, and reviews team leaderboard results.
- **Student (Participant):** Authenticates into the platform, joins active quiz sessions using a room code, gets assigned to a team, submits answers, and views team scores.

## User stories

1. **As an Instructor**, I want to create and edit quizzes with questions, multiple-choice options, and point values so that I can evaluate student comprehension.
   Accepted when: The instructor must be logged in to create or edit quizzes; each question requires at least two options and exactly one marked correct answer; quizzes can be saved and published for student access.

2. **As an Instructor**, I want to launch a quiz session and automatically divide joining students into balanced teams so that students collaborate together.
   Accepted when: The instructor selects the number of teams (e.g., 2 to 4) when launching a session; joining students are automatically assigned to teams in balanced order.

3. **As a Student**, I want to log into my account and join an active quiz session using a room code so that my answers contribute to my assigned team.
   Accepted when: The student must be authenticated before joining; entering a valid session code registers the student into a team; an invalid or expired code displays an error message.

4. **As a Student**, I want to submit answers to quiz questions so that my responses are evaluated for points.
   Accepted when: Questions and their options are displayed to the student; the student can select and submit an answer; points are awarded only for correct submissions.

5. **As a Student**, I want my individual question scores to contribute directly to my team's cumulative score so that all team members share collective responsibility for winning.
   Accepted when: Each correct answer adds points to the team total; the team leaderboard updates as members submit answers.

6. **As an Instructor**, I want to manually end a quiz session so that no further answers can be submitted.

7. **As an Instructor**, I want to view a post-quiz summary leaderboard showing team scores and top contributors.

## MVP scope

Must have:

- Story 1: Instructor creates and manages quizzes with questions and options.
- Story 2: Instructor launches a session with automated team distribution.
- Story 3: Students authenticate and join quiz sessions via room code.
- Story 4: Students submit answers to questions.
- Story 5: Individual scores aggregate into cumulative team scores on the leaderboard.

Nice to have:

- Story 6: Instructor manually ends/locks an active session.
- Story 7: Post-game summary view showing top student contributors per team.

## Entities

| Entity | Main attributes | Relations |
| :--- | :--- | :--- |
| User | name, email, password_hash, role | has many Quizzes, has many TeamMembers |
| Quiz | title, description, is_published | belongs to User (Instructor), has many Questions, has many GameSessions |
| Question | prompt, options, correct_option_index, base_points | belongs to Quiz, has many PlayerAnswers |
| GameSession | room_code, status | belongs to Quiz, has many Teams |
| Team | name, total_score | belongs to GameSession, has many TeamMembers |
| TeamMember | individual_score | belongs to Team, belongs to User (Student), has many PlayerAnswers |
| PlayerAnswer | selected_option_index, points_awarded, is_correct | belongs to TeamMember, belongs to Question |

## Stretch feature

One of: search + pagination, file upload, real-time, scheduled task.

What it does in this app:
Real-time. The core MVP operates reliably over standard HTTP REST APIs (allowing students to log in, join sessions, submit answers, and view team leaderboards). As the stretch feature, Socket.IO over WebSockets is integrated with shared TypeScript contracts between the Vue 3 (TypeScript) frontend and the backend. When enabled, any submitted answer instantly broadcasts typed events (score:updated, leaderboard:refreshed) to the Vue 3 client, dynamically updating team scores on the leaderboard across all connected participant and host screens without manual page refreshes.

## Repository

https://github.com/Maestro0602/Online-Quiz.git
