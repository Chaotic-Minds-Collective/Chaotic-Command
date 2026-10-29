import { GuildSummary } from './guild-summary.js';
import { mockGuildSummary, mockGuildSummaries } from './guild-summary.mock.js';

describe('GuildSummary', () => {
  it('creates an entity from a plain object', () => {
    const guild = GuildSummary.from({
      id: 'g1',
      name: 'Test Guild',
      iconUrl: 'https://example.com/icon.png',
      isOwner: true,
      canManage: false,
      botInstalled: true,
    });
    expect(guild.id).toBe('g1');
    expect(guild.iconUrl).toBe('https://example.com/icon.png');
    expect(guild.isOwner).toBe(true);
    expect(guild.canManage).toBe(false);
    expect(guild.botInstalled).toBe(true);
  });

  it('round-trips through toObject', () => {
    const guild = mockGuildSummary({ id: 'x', iconUrl: 'https://example.com/a.png' });
    expect(GuildSummary.from(guild.toObject()).toObject()).toEqual(guild.toObject());
    expect(guild.toObject().id).toBe('x');
  });

  it('defaults missing iconUrl to null', () => {
    const guild = GuildSummary.from({
      id: 'g',
      name: 'A',
      isOwner: false,
      canManage: false,
      botInstalled: false,
    });
    expect(guild.iconUrl).toBeNull();
  });

  describe('initials()', () => {
    it('returns the first letters of the first two words', () => {
      expect(mockGuildSummary({ name: 'Chaotic Minds HQ' }).initials()).toBe('CM');
    });

    it('returns a single letter for a single word', () => {
      expect(mockGuildSummary({ name: 'study' }).initials()).toBe('S');
    });

    it('handles empty and whitespace names', () => {
      expect(mockGuildSummary({ name: '   ' }).initials()).toBe('');
    });
  });

  it('supports mock overrides', () => {
    expect(mockGuildSummary({ botInstalled: false }).botInstalled).toBe(false);
    expect(mockGuildSummaries()).toHaveLength(3);
  });
});
