/**
 * default localStorage key used to remember the last visited guild.
 */
export const LAST_GUILD_STORAGE_KEY = 'guildpilot:last-guild-id';

/**
 * read the id of the last visited guild from localStorage.
 * returns undefined when storage is unavailable or empty.
 */
export function readLastGuildId(storageKey: string = LAST_GUILD_STORAGE_KEY): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(storageKey) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * remember the id of the last visited guild in localStorage.
 * silently ignores storage errors (private mode, quota, SSR).
 */
export function writeLastGuildId(guildId: string, storageKey: string = LAST_GUILD_STORAGE_KEY): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, guildId);
  } catch {
    // storage is not available - nothing to remember.
  }
}
