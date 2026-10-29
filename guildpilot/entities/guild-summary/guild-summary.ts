export type PlainGuildSummary = {
  /**
   * unique id of the guild.
   */
  id: string;

  /**
   * display name of the guild.
   */
  name: string;

  /**
   * url of the guild icon, if any.
   */
  iconUrl?: string | null;

  /**
   * whether the current user owns the guild.
   */
  isOwner: boolean;

  /**
   * whether the current user can manage the guild.
   */
  canManage: boolean;

  /**
   * whether the GuildPilot bot is installed in the guild.
   */
  botInstalled: boolean;
};

export class GuildSummary {
  constructor(
    /**
     * unique id of the guild.
     */
    readonly id: string,

    /**
     * display name of the guild.
     */
    readonly name: string,

    /**
     * url of the guild icon, if any.
     */
    readonly iconUrl: string | null,

    /**
     * whether the current user owns the guild.
     */
    readonly isOwner: boolean,

    /**
     * whether the current user can manage the guild.
     */
    readonly canManage: boolean,

    /**
     * whether the GuildPilot bot is installed in the guild.
     */
    readonly botInstalled: boolean
  ) {}

  /**
   * get up to two uppercase initials of the guild name,
   * e.g. "Chaotic Minds HQ" => "CM".
   */
  initials(): string {
    const words = (this.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0] ?? '')
      .join('')
      .toUpperCase();
  }

  /**
   * serialize a GuildSummary into
   * a serializable object.
   */
  toObject(): PlainGuildSummary {
    return {
      id: this.id,
      name: this.name,
      iconUrl: this.iconUrl,
      isOwner: this.isOwner,
      canManage: this.canManage,
      botInstalled: this.botInstalled,
    };
  }

  /**
   * create a GuildSummary object from a
   * plain object.
   */
  static from(plain: PlainGuildSummary): GuildSummary {
    const {
      id = '',
      name = '',
      iconUrl = null,
      isOwner = false,
      canManage = false,
      botInstalled = false,
    } = plain || ({} as PlainGuildSummary);
    return new GuildSummary(id, name, iconUrl ?? null, !!isOwner, !!canManage, !!botInstalled);
  }
}
