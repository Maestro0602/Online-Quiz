import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { store } from '../data/store.js';
import { User, UserRole } from '@quizchaos/shared';
import { hashPassword, verifyPassword, encryptEmail, decryptEmail } from '../utils/crypto.js';

const VALID_ROLES = ['instructor', 'teacher', 'student', 'user'];

@Controller('api/auth')
export class AuthController {
  @Get('demo-users')
  getDemoUsers() {
    const users = Array.from(store.users.values()).map(u => ({
      id: u.id,
      name: u.name,
      email: decryptEmail(u.email),
      role: u.role,
      avatar: u.avatar
    }));
    return { users };
  }

  @Post('login')
  login(@Body() body: { email?: string; password?: string }, @Res() res: Response) {
    const { email, password } = body;

    if (!email) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Email is required' });
    }

    const normalizedInput = email.toLowerCase().trim();
    const user = Array.from(store.users.values()).find(
      u => decryptEmail(u.email).toLowerCase() === normalizedInput
    );

    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'User not found with this email' });
    }

    if (password && user.password && !verifyPassword(password, user.password)) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid password' });
    }

    const { password: _, ...userSafe } = user;
    return res.status(HttpStatus.OK).json({
      user: { ...userSafe, email: decryptEmail(user.email) },
      token: `mock-token-${user.id}`
    });
  }

  @Post('register')
  register(
    @Body() body: { name?: string; email?: string; password?: string; role?: string; avatar?: string },
    @Res() res: Response
  ) {
    const { name, email, password, role, avatar } = body;

    if (!name || !email || !password) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Name, email, and password are required' });
    }

    const assignedRole = (role && VALID_ROLES.includes(role)) ? role : 'user';

    const normalizedEmail = email.trim().toLowerCase();
    const existing = Array.from(store.users.values()).find(
      u => decryptEmail(u.email).toLowerCase() === normalizedEmail
    );

    if (existing) {
      return res.status(HttpStatus.CONFLICT).json({ error: 'User with this email already exists' });
    }

    const defaultAvatar = name.substring(0, 2).toUpperCase();

    const newUser: User = {
      id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: encryptEmail(normalizedEmail),
      role: assignedRole as UserRole,
      password: hashPassword(password),
      avatar: avatar || defaultAvatar
    };

    store.users.set(newUser.id, newUser);

    const { password: _, ...userSafe } = newUser;
    return res.status(HttpStatus.CREATED).json({
      user: { ...userSafe, email: normalizedEmail },
      token: `mock-token-${newUser.id}`
    });
  }
}
