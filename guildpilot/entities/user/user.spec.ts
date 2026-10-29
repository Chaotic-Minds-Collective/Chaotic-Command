import { describe, it, expect } from 'vitest';
import { User } from './user.js';
import { mockUser, mockUsers } from './user.mock.js';

describe('User', () => {
  it('creates a user from a plain object', () => {
    const user = User.fromObject({
      id: 'u-9',
      discordId: '123',
      username: 'zed',
      globalName: 'Zed',
      avatarUrl: 'https://cdn.example.com/a.png',
      email: 'zed@example.com',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(user.id).toBe('u-9');
    expect(user.discordId).toBe('123');
    expect(user.username).toBe('zed');
    expect(user.globalName).toBe('Zed');
    expect(user.email).toBe('zed@example.com');
  });

  it('defaults optional fields to null and id to discordId', () => {
    const user = User.fromObject({ discordId: '456', username: 'kairo' });
    expect(user.id).toBe('456');
    expect(user.globalName).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.email).toBeNull();
    expect(typeof user.createdAt).toBe('string');
  });

  it('serializes with toObject including id', () => {
    const user = mockUser();
    const obj = user.toObject();
    expect(obj.id).toBe(user.id);
    expect(obj.discordId).toBe(user.discordId);
    expect(obj.createdAt).toBe(user.createdAt);
  });

  it('round-trips through toObject and fromObject', () => {
    const user = mockUser({ username: 'mira' });
    expect(User.fromObject(user.toObject()).toObject()).toEqual(user.toObject());
  });

  it('displayName falls back to username', () => {
    expect(mockUser({ globalName: null, username: 'nova' }).displayName).toBe('nova');
    expect(mockUser({ globalName: 'Nova' }).displayName).toBe('Nova');
  });

  it('mocks support partial overrides', () => {
    expect(mockUser({ username: 'custom' }).username).toBe('custom');
    expect(mockUsers().length).toBeGreaterThan(1);
  });
});
