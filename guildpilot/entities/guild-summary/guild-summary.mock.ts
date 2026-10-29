import { GuildSummary } from './guild-summary.js';
import type { PlainGuildSummary } from './guild-summary.js';

/**
 * create a single mock GuildSummary, with optional overrides.
 */
export function mockGuildSummary(overrides: Partial<PlainGuildSummary> = {}) {
  return GuildSummary.from({
    id: 's1',
    name: 'Chaotic Minds HQ',
    iconUrl: null,
    isOwner: true,
    canManage: true,
    botInstalled: true,
    ...overrides,
  });
}

/**
 * create a list of mock GuildSummary entities.
 */
export function mockGuildSummaries() {
  return [
    mockGuildSummary(),
    mockGuildSummary({
      id: 's2',
      name: 'Pixel Forge Gaming',
      isOwner: false,
      canManage: true,
      botInstalled: true,
    }),
    mockGuildSummary({
      id: 's3',
      name: 'Study Lounge',
      isOwner: false,
      canManage: true,
      botInstalled: false,
    }),
  ];
}
