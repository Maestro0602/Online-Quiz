import { User, Quiz, GameSession } from '@quizchaos/shared';

export interface DataStore {
  users: Map<string, User>;
  quizzes: Map<string, Quiz>;
  sessions: Map<string, GameSession>;
}

export const TEAM_PRESETS = [
  { name: 'Red Rockets', color: '#e21b3c', badge: 'R' },
  { name: 'Blue Blasters', color: '#1368ce', badge: 'B' },
  { name: 'Golden Geeks', color: '#d88b02', badge: 'G' },
  { name: 'Green Giants', color: '#26890c', badge: 'V' },
  { name: 'Purple Phantoms', color: '#8e44ad', badge: 'P' },
  { name: 'Cosmic Comets', color: '#e67e22', badge: 'C' }
];

export const store: DataStore = {
  users: new Map(),
  quizzes: new Map(),
  sessions: new Map()
};

// Seed default users
const defaultUsers: User[] = [
  {
    id: 'u-inst-1',
    name: 'Prof. Ada Lovelace',
    email: 'ada@university.edu',
    role: 'instructor',
    password: 'password123',
    avatar: 'A'
  },
  {
    id: 'u-inst-2',
    name: 'Dr. Alan Turing',
    email: 'alan@university.edu',
    role: 'instructor',
    password: 'password123',
    avatar: 'T'
  },
  {
    id: 'u-stud-1',
    name: 'Alex Rivera',
    email: 'alex@student.edu',
    role: 'student',
    password: 'password123',
    avatar: 'AR'
  },
  {
    id: 'u-stud-2',
    name: 'Bella Chen',
    email: 'bella@student.edu',
    role: 'student',
    password: 'password123',
    avatar: 'BC'
  },
  {
    id: 'u-stud-3',
    name: 'Carlos Gomez',
    email: 'carlos@student.edu',
    role: 'student',
    password: 'password123',
    avatar: 'CG'
  },
  {
    id: 'u-stud-4',
    name: 'Diana Prince',
    email: 'diana@student.edu',
    role: 'student',
    password: 'password123',
    avatar: 'DP'
  }
];

defaultUsers.forEach(u => store.users.set(u.id, u));

// Seed default quizzes
const defaultQuizzes: Quiz[] = [
  {
    id: 'quiz-cs-101',
    instructor_id: 'u-inst-1',
    instructor_name: 'Prof. Ada Lovelace',
    title: 'Computer Science & Web Dev Showdown',
    description: 'Test your knowledge on TypeScript, Vue 3, algorithms, and browser wizardry!',
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        quiz_id: 'quiz-cs-101',
        prompt: 'Which TypeScript feature guarantees compile-time type safety without runtime overhead?',
        options: [
          'Type Annotations & Interfaces',
          'Classes & Prototypes',
          'Async / Await Promises',
          'JSON Schema Validators'
        ],
        correct_option_index: 0,
        base_points: 1000,
        time_limit_seconds: 20
      },
      {
        id: 'q2',
        quiz_id: 'quiz-cs-101',
        prompt: 'In Vue 3 Composition API, what function creates a deep reactive object?',
        options: [
          'computed()',
          'reactive()',
          'provide()',
          'onMounted()'
        ],
        correct_option_index: 1,
        base_points: 1000,
        time_limit_seconds: 15
      },
      {
        id: 'q3',
        quiz_id: 'quiz-cs-101',
        prompt: 'What protocol provides full-duplex real-time communication between browser and server?',
        options: [
          'HTTP/1.1 REST',
          'GraphQL Queries',
          'WebSockets',
          'FTP File Transfer'
        ],
        correct_option_index: 2,
        base_points: 1000,
        time_limit_seconds: 20
      },
      {
        id: 'q4',
        quiz_id: 'quiz-cs-101',
        prompt: 'What is the average time complexity of searching in a Hash Map / Hash Table?',
        options: [
          'O(n log n)',
          'O(n)',
          'O(log n)',
          'O(1)'
        ],
        correct_option_index: 3,
        base_points: 1000,
        time_limit_seconds: 15
      },
      {
        id: 'q5',
        quiz_id: 'quiz-cs-101',
        prompt: 'What makes Vue 3 significantly faster and smaller than Vue 2?',
        options: [
          'Proxy-based Reactivity & Tree-shaking',
          'Removing the Virtual DOM completely',
          'Running JavaScript directly in WebAssembly',
          'Compiling strictly into C++ binaries'
        ],
        correct_option_index: 0,
        base_points: 1000,
        time_limit_seconds: 20
      }
    ]
  },
  {
    id: 'quiz-trivia-fun',
    instructor_id: 'u-inst-1',
    instructor_name: 'Prof. Ada Lovelace',
    title: 'Science and Tech Trivia',
    description: 'Fast-paced team brain challenge with tricky science and tech questions!',
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    questions: [
      {
        id: 'qt1',
        quiz_id: 'quiz-trivia-fun',
        prompt: 'What planet in our solar system has the most moons confirmed by astronomers?',
        options: [
          'Jupiter',
          'Saturn',
          'Uranus',
          'Neptune'
        ],
        correct_option_index: 1,
        base_points: 1000,
        time_limit_seconds: 15
      },
      {
        id: 'qt2',
        quiz_id: 'quiz-trivia-fun',
        prompt: 'Who was widely regarded as the worlds first computer programmer?',
        options: [
          'Grace Hopper',
          'Ada Lovelace',
          'Alan Turing',
          'Charles Babbage'
        ],
        correct_option_index: 1,
        base_points: 1000,
        time_limit_seconds: 15
      },
      {
        id: 'qt3',
        quiz_id: 'quiz-trivia-fun',
        prompt: 'What year was the World Wide Web introduced to the public by Tim Berners-Lee?',
        options: [
          '1985',
          '1989',
          '1991',
          '1995'
        ],
        correct_option_index: 2,
        base_points: 1000,
        time_limit_seconds: 20
      }
    ]
  }
];

defaultQuizzes.forEach(q => store.quizzes.set(q.id, q));

