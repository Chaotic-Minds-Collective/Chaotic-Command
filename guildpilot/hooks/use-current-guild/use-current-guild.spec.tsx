import React, { type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { renderHook, act } from '@testing-library/react';
import { mockGuildSummaries } from '@chaotic-minds/guildpilot.entities.guild-summary';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { useCurrentGuild } from './use-current-guild.js';
import { GuildProvider } from './guild-provider.js';
import { useGuild } from './guild-context.js';
import { readLastGuildId } from './guild-storage.js';

const guilds = mockGuildSummaries();

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <MockProvider initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/guilds/:guildId/*" element={children} />
          <Route path="*" element={children} />
        </Routes>
      </MockProvider>
    );
  };
}

it('should resolve the guild from the route', () => {
  const { result } = renderHook(
    () => useCurrentGuild({ mockData: guilds, storageKey: 'test-route' }),
    { wrapper: createWrapper('/guilds/s2/audit') }
  );

  expect(result.current.guild?.id).toBe('s2');
  expect(result.current.guilds).toHaveLength(3);
  expect(result.current.loading).toBe(false);
});

it('should remember the route guild in localStorage', () => {
  renderHook(() => useCurrentGuild({ mockData: guilds, storageKey: 'test-remember' }), {
    wrapper: createWrapper('/guilds/s3'),
  });

  expect(readLastGuildId('test-remember')).toBe('s3');
});

it('should fall back to the first guild without a route param', () => {
  const { result } = renderHook(
    () => useCurrentGuild({ mockData: guilds, storageKey: 'test-fallback' }),
    { wrapper: createWrapper('/') }
  );

  expect(result.current.guild?.id).toBe('s1');
});

it('should return no guild for an unknown route guild id', () => {
  const { result } = renderHook(
    () => useCurrentGuild({ mockData: guilds, storageKey: 'test-unknown' }),
    { wrapper: createWrapper('/guilds/nope') }
  );

  expect(result.current.guild).toBeUndefined();
});

it('should switch guilds and keep the current page', () => {
  const { result } = renderHook(
    () => useCurrentGuild({ mockData: guilds, storageKey: 'test-switch' }),
    { wrapper: createWrapper('/guilds/s1/audit') }
  );

  act(() => {
    result.current.switchGuild('s2');
  });

  expect(result.current.guild?.id).toBe('s2');
  expect(readLastGuildId('test-switch')).toBe('s2');
});

it('should provide the current guild through GuildProvider', () => {
  const { result } = renderHook(() => useGuild(), {
    wrapper: ({ children }) => (
      <MockProvider initialEntries={['/guilds/s2']}>
        <Routes>
          <Route
            path="/guilds/:guildId"
            element={
              <GuildProvider mockData={guilds} storageKey="test-provider">
                {children}
              </GuildProvider>
            }
          />
        </Routes>
      </MockProvider>
    ),
  });

  expect(result.current.guild?.name).toBe('Pixel Forge Gaming');
});
