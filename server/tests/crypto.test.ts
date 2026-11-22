import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  encryptEmail,
  decryptEmail
} from '../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  it('hashes passwords with unique salts and verifies correctly', () => {
    const hashA = hashPassword('SuperSecret99!');
    const hashB = hashPassword('SuperSecret99!');

    assert.notEqual(hashA, hashB);
    assert.ok(hashA.includes(':'));
    assert.equal(verifyPassword('SuperSecret99!', hashA), true);
    assert.equal(verifyPassword('WrongPassword', hashA), false);
    assert.equal(verifyPassword('SuperSecret99!', ''), false);
  });

  it('supports legacy plaintext password verification fallback', () => {
    assert.equal(verifyPassword('password123', 'password123'), true);
    assert.equal(verifyPassword('wrong', 'password123'), false);
  });

  it('encrypts and decrypts emails with AES-256-GCM and normalizes casing', () => {
    const enc1 = encryptEmail('  Student@Example.COM  ');
    const enc2 = encryptEmail('student@example.com');

    assert.notEqual(enc1, enc2);
    assert.equal(enc1.split(':').length, 3);
    assert.equal(decryptEmail(enc1), 'student@example.com');
    assert.equal(decryptEmail(enc2), 'student@example.com');
  });

  it('returns plain unencrypted email unchanged in decryptEmail', () => {
    assert.equal(decryptEmail('plain@university.edu'), 'plain@university.edu');
  });
});
