import crypto from 'crypto';
import { UserRole } from '@quizchaos/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'qiuizez-jwt-dev-secret-change-in-prod';
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface JwtPayload {
  sub: string;
  role: UserRole;
  name: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

export function signJwt(
  payload: { sub: string; role: UserRole; name: string },
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    sub: payload.sub,
    role: payload.role,
    name: payload.name,
    iat: now,
    exp: now + expiresInSeconds
  };

  const headerPart = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadPart = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerPart}.${payloadPart}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest();
  const signaturePart = base64UrlEncode(signature);

  return `${data}.${signaturePart}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const data = `${headerPart}.${payloadPart}`;

  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(data).digest()
  );

  const actualBuf = Buffer.from(signaturePart);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadPart)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.sub || !parsed.role || !parsed.exp || parsed.exp < now) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
