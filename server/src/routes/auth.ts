import { Router, Request, Response } from 'express';
import { store } from '../data/store.js';
import { User, UserRole } from '@quizchaos/shared';

const router = Router();

// Get demo accounts for quick testing
router.get('/demo-users', (_req: Request, res: Response) => {
  const users = Array.from(store.users.values()).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar
  }));
  res.json({ users });
});

// Login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = Array.from(store.users.values()).find(
    u => u.email.toLowerCase() === email.toLowerCase().trim()
  );

  if (!user) {
    return res.status(401).json({ error: 'User not found with this email' });
  }

  if (password && user.password && user.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const { password: _, ...userSafe } = user;
  return res.json({ user: userSafe, token: `mock-token-${user.id}` });
});

// Register
router.post('/register', (req: Request, res: Response) => {
  const { name, email, password, role, avatar } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  if (role !== 'instructor' && role !== 'student') {
    return res.status(400).json({ error: 'Role must be either instructor or student' });
  }

  const existing = Array.from(store.users.values()).find(
    u => u.email.toLowerCase() === email.toLowerCase().trim()
  );

  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const avatars = role === 'instructor' ? ['👩‍🏫', '👨‍🏫', '🧑‍🔬', '🧙‍♂️'] : ['🦊', '🐼', '🦁', '🦄', '🚀', '⚡'];
  const defaultAvatar = avatars[Math.floor(Math.random() * avatars.length)];

  const newUser: User = {
    id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: role as UserRole,
    password: password || 'password123',
    avatar: avatar || defaultAvatar
  };

  store.users.set(newUser.id, newUser);

  const { password: _, ...userSafe } = newUser;
  return res.status(201).json({ user: userSafe, token: `mock-token-${newUser.id}` });
});

export default router;
