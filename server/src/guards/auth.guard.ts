import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { UserRole } from '@quizchaos/shared';
import { verifyJwt, JwtPayload } from '../utils/jwt.js';

function extractAndVerifyToken(context: ExecutionContext): JwtPayload {
  const req = context.switchToHttp().getRequest();
  const authHeader: string | undefined = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException('Authentication token required');
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyJwt(token);
  if (!payload) {
    throw new UnauthorizedException('Invalid or expired authentication token');
  }

  req.user = payload;
  return payload;
}

const CREATOR_ROLES: UserRole[] = ['instructor', 'teacher'];
const HOST_ROLES: UserRole[] = ['instructor', 'teacher', 'host'];

@Injectable()
export class CreatorAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = extractAndVerifyToken(context);
    if (!CREATOR_ROLES.includes(user.role)) {
      throw new ForbiddenException('Instructor or teacher role required to manage quizzes');
    }
    return true;
  }
}

@Injectable()
export class HostAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = extractAndVerifyToken(context);
    if (!HOST_ROLES.includes(user.role)) {
      throw new ForbiddenException('Host, teacher, or instructor role required to launch or control sessions');
    }
    return true;
  }
}
