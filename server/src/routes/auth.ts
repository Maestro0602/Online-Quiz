import { Router, Request, Response } from 'express';
import { store } from '../data/store.js';
import { User, UserRole } from '@quizchaos/shared';
import { hashPassword, verifyPassword, encryptEmail, decryptEmail } from '../utils/crypto.js';

const router = Router();

const VALID_ROLES = ['instructor', 'teacher', 'student', 'user'];

// Get demo accounts for quick testing
router.get('/demo-users', (_req: Request, res: Response) => {
  const users = Array.from(store.users.values()).map(u => ({
    id: u.id,
    name: u.name,
    email: decryptEmail(u.email),
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

  const normalizedInput = email.toLowerCase().trim();
  const user = Array.from(store.users.values()).find(
    u => decryptEmail(u.email).toLowerCase() === normalizedInput
  );

  if (!user) {
    return res.status(401).json({ error: 'User not found with this email' });
  }

  if (password && user.password && !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const { password: _, ...userSafe } = user;
  return res.json({
    user: { ...userSafe, email: decryptEmail(user.email) },
    token: `mock-token-${user.id}`
  });
});

// Register
router.post('/register', (req: Request, res: Response) => {
  const { name, email, password, role, avatar } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const assignedRole = (role && VALID_ROLES.includes(role)) ? role : 'user';

  const normalizedEmail = email.trim().toLowerCase();
  const existing = Array.from(store.users.values()).find(
    u => decryptEmail(u.email).toLowerCase() === normalizedEmail
  );

  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const defaultAvatar = name.substring(0, 2).toUpperCase();

  const newUser: User = {
    id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: encryptEmail(normalizedEmail),
    role: assignedRole as UserRole,
    password: hashPassword(password || 'password123'),
    avatar: avatar || defaultAvatar
  };

  store.users.set(newUser.id, newUser);

  const { password: _, ...userSafe } = newUser;
  return res.status(201).json({
    user: { ...userSafe, email: normalizedEmail },
    token: `mock-token-${newUser.id}`
  });
});

export default router;

