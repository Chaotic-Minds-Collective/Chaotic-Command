import { createContext, useContext } from 'react';
import type { CurrentGuildValue } from './use-current-guild.js';

/**
 * context holding the current guild value.
 */
export const GuildContext = createContext<CurrentGuildValue | undefined>(undefined);

/**
 * read the current guild value provided by a GuildProvider.
 * throws when used outside of a GuildProvider.
 */
export function useGuild(): CurrentGuildValue {
  const value = useContext(GuildContext);
  if (!value) {
    throw new Error('useGuild must be used within a GuildProvider');
  }
  return value;
}
