export type PlainUser = {
  /**
   * unique id of the user.
   */
  id?: string;

  /**
   * Discord snowflake id of the user.
   */
  discordId: string;

  /**
   * Discord username.
   */
  username: string;

  /**
   * Discord global (display) name.
   */
  globalName?: string | null;

  /**
   * url of the user avatar.
   */
  avatarUrl?: string | null;

  /**
   * email of the user.
   */
  email?: string | null;

  /**
   * ISO date string of when the user was created.
   */
  createdAt?: string;
};

export type UserObject = {
  id: string;
  discordId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  email: string | null;
  createdAt: string;
};

export class User {
  constructor(
    /**
     * unique id of the user.
     */
    readonly id: string,

    /**
     * Discord snowflake id of the user.
     */
    readonly discordId: string,

    /**
     * Discord username.
     */
    readonly username: string,

    /**
     * Discord global (display) name.
     */
    readonly globalName: string | null,

    /**
     * url of the user avatar.
     */
    readonly avatarUrl: string | null,

    /**
     * email of the user.
     */
    readonly email: string | null,

    /**
     * ISO date string of when the user was created.
     */
    readonly createdAt: string
  ) {}

  /**
   * the name to display for the user:
   * the global name when set, otherwise the username.
   */
  get displayName(): string {
    return this.globalName || this.username;
  }

  /**
   * serialize a User into a serializable object.
   */
  toObject(): UserObject {
    return {
      id: this.id,
      discordId: this.discordId,
      username: this.username,
      globalName: this.globalName,
      avatarUrl: this.avatarUrl,
      email: this.email,
      createdAt: this.createdAt,
    };
  }

  /**
   * create a User object from a plain object.
   */
  static fromObject(plainUser: PlainUser): User {
    const {
      id = '',
      discordId = '',
      username = '',
      globalName = null,
      avatarUrl = null,
      email = null,
      createdAt = new Date().toISOString(),
    } = plainUser || ({} as PlainUser);

    return new User(
      id || discordId,
      discordId,
      username,
      globalName ?? null,
      avatarUrl ?? null,
      email ?? null,
      createdAt
    );
  }

  /**
   * alias of fromObject.
   */
  static from(plainUser: PlainUser): User {
    return User.fromObject(plainUser);
  }
}
