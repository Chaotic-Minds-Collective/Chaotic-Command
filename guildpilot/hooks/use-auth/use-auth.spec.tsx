import React, { type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { mockUser } from '@chaotic-minds/guildpilot.entities.user';
import { useAuth } from './use-auth.js';

function wrapper({ children }: { children?: ReactNode }) {
  return <MockProvider>{children}</MockProvider>;
}

it('should return the mock user without loading', () => {
  const { result } = renderHook(() => useAuth({ mockData: mockUser() }), { wrapper });

  expect(result.current.user?.username).toBe('danielle');
  expect(result.current.loading).toBe(false);
});

it('should return no user for a signed-out mock', () => {
  const { result } = renderHook(() => useAuth({ mockData: null }), { wrapper });

  expect(result.current.user).toBeUndefined();
});

it('should build a Discord authorize url when a client id is given', () => {
  const { result } = renderHook(
    () =>
      useAuth({
        mockData: null,
        clientId: '12345',
        redirectUri: 'https://app.example.com/auth/callback',
      }),
    { wrapper }
  );

  expect(result.current.isMock).toBe(false);
  expect(result.current.loginUrl.includes('discord.com/api/oauth2/authorize')).toBe(true);
  expect(result.current.loginUrl.includes('client_id=12345')).toBe(true);
  expect(result.current.loginUrl.includes('response_type=code')).toBe(true);
});

it('should use a mock login url without a client id', () => {
  const { result } = renderHook(() => useAuth({ mockData: null }), { wrapper });

  expect(result.current.isMock).toBe(true);
  expect(result.current.loginUrl.includes('mock=1')).toBe(true);
});

it('should clear the user on logout', async () => {
  const { result } = renderHook(() => useAuth({ mockData: mockUser() }), { wrapper });

  await act(async () => {
    await result.current.logout();
  });

  expect(result.current.user).toBeUndefined();
});
