import React, { type ReactNode } from 'react';
import { GuildContext } from './guild-context.js';
import { useCurrentGuild, type UseCurrentGuildOptions } from './use-current-guild.js';

export type GuildProviderProps = UseCurrentGuildOptions & {
  /**
   * children that can read the current guild with `useGuild`.
   */
  children?: ReactNode;
};

/**
 * provides the current guild, the guild list and `switchGuild` to its children.
 */
export function GuildProvider({ children, mockData, paramName, storageKey, getGuildPath }: GuildProviderProps) {
  const value = useCurrentGuild({ mockData, paramName, storageKey, getGuildPath });

  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>;
}
