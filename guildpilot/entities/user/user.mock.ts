import { User } from './user.js';
import type { PlainUser } from './user.js';

const baseUsers: PlainUser[] = [
  {
    id: 'u-1',
    discordId: '812345678901234567',
    username: 'danielle',
    globalName: 'Danielle',
    avatarUrl: null,
    email: 'danielle@example.com',
    createdAt: '2024-01-15T10:00:00.000Z',
  },
  {
    id: 'u-2',
    discordId: '823456789012345678',
    username: 'rook',
    globalName: 'Rook',
    avatarUrl: null,
    email: null,
    createdAt: '2024-02-20T12:30:00.000Z',
  },
  {
    id: 'u-3',
    discordId: '834567890123456789',
    username: 'nova',
    globalName: null,
    avatarUrl: null,
    email: 'nova@example.com',
    createdAt: '2024-03-05T08:15:00.000Z',
  },
];

/**
 * mock a single user, supporting partial overrides.
 */
export function mockUser(overrides: Partial<PlainUser> = {}): User {
  return User.fromObject({ ...baseUsers[0], ...overrides });
}

/**
 * mock a list of users, supporting partial overrides applied to every user.
 */
export function mockUsers(overrides: Partial<PlainUser> = {}): User[] {
  return baseUsers.map((plain) => User.fromObject({ ...plain, ...overrides }));
}
