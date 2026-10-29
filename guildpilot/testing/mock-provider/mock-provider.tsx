import React, { type ComponentProps, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing/react/index.js';
import { GuildpilotTheme } from '@chaotic-minds/design.guildpilot-theme';
import { MockContext } from './mock-provider-context.js';

export type MockProviderMocks = ComponentProps<typeof MockedProvider>['mocks'];

export type MockProviderProps = {
  /**
   * sets the component children.
   */
  children?: ReactNode;

  /**
   * Apollo mocked responses to serve to GraphQL operations.
   */
  mocks?: MockProviderMocks;

  /**
   * initial history entries of the memory router.
   */
  initialEntries?: string[];

  /**
   * index of the active entry in `initialEntries`.
   */
  initialIndex?: number;

  /**
   * initial mode of the GuildPilot theme.
   */
  initialTheme?: 'light' | 'dark';

  /**
   * do not use the memory router.
   */
  noRouter?: boolean;

  /**
   * do not use the theme.
   */
  noTheme?: boolean;
};

/**
 * a mock provider for testing and previewing GuildPilot components.
 * combines a MemoryRouter, an Apollo MockedProvider and the GuildPilot theme.
 */
export function MockProvider({
  children,
  mocks = [],
  initialEntries = ['/'],
  initialIndex,
  initialTheme = 'dark',
  noRouter,
  noTheme,
}: MockProviderProps) {
  const apollo = (
    <MockedProvider mocks={mocks} showWarnings={false}>
      {children}
    </MockedProvider>
  );

  const themed = noTheme ? apollo : <GuildpilotTheme initialTheme={initialTheme}>{apollo}</GuildpilotTheme>;

  const routed = noRouter ? (
    themed
  ) : (
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      {themed}
    </MemoryRouter>
  );

  return <MockContext.Provider value>{routed}</MockContext.Provider>;
}
