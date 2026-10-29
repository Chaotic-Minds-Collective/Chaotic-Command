import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { GuildSummary, type PlainGuildSummary } from '@chaotic-minds/guildpilot.entities.guild-summary';
import { LAST_GUILD_STORAGE_KEY, readLastGuildId, writeLastGuildId } from './guild-storage.js';

export const MY_GUILDS_QUERY = gql`
  query MyGuilds {
    listUserGuilds {
      id
      name
      iconUrl
      isOwner
      canManage
      botInstalled
    }
  }
`;

export type MyGuildsQueryResult = {
  listUserGuilds?: (PlainGuildSummary | null)[] | null;
};

export type UseCurrentGuildOptions = {
  /**
   * provide guilds directly and skip the network query.
   */
  mockData?: GuildSummary[];

  /**
   * name of the route param holding the guild id. defaults to `guildId`.
   */
  paramName?: string;

  /**
   * localStorage key used to remember the last guild.
   */
  storageKey?: string;

  /**
   * build the path to navigate to when switching guilds.
   * by default the current guild id segment is replaced in the current path,
   * or `/guilds/<id>` is used when the route has no guild id.
   */
  getGuildPath?: (guildId: string, currentPathname: string, currentGuildId?: string) => string;
};

export type CurrentGuildValue = {
  /**
   * the current guild, resolved from the route, the last remembered guild or the first guild.
   */
  guild?: GuildSummary;

  /**
   * all guilds of the current user.
   */
  guilds: GuildSummary[];

  /**
   * the guild id read from the route, if any.
   */
  guildId?: string;

  /**
   * whether the guilds are loading.
   */
  loading: boolean;

  /**
   * error message of the guilds query, if any.
   */
  error?: string;

  /**
   * switch the current guild, navigating to the same page of the target guild.
   */
  switchGuild: (id: string) => void;

  /**
   * refetch the guild list.
   */
  refetch: () => void;
};

function defaultGuildPath(guildId: string, pathname: string, currentGuildId?: string): string {
  if (!currentGuildId) return `/guilds/${encodeURIComponent(guildId)}`;
  const segments = pathname.split('/');
  const index = segments.findIndex((segment) => decodeURIComponent(segment) === currentGuildId);
  if (index < 0) return `/guilds/${encodeURIComponent(guildId)}`;
  return [...segments.slice(0, index), encodeURIComponent(guildId), ...segments.slice(index + 1)].join('/');
}

const noop = () => undefined;

/**
 * reads the guild id from the route, fetches the guilds of the current user
 * and resolves the current guild. the last used guild is remembered in localStorage.
 * @param options optional mock data and routing/storage configuration.
 * @returns the current guild, all guilds and a function to switch guilds.
 */
export function useCurrentGuild(options?: UseCurrentGuildOptions): CurrentGuildValue {
  const {
    mockData,
    paramName = 'guildId',
    storageKey = LAST_GUILD_STORAGE_KEY,
    getGuildPath = defaultGuildPath,
  } = options || {};
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const guildId = params[paramName];
  const [lastGuildId, setLastGuildId] = useState<string | undefined>(() => readLastGuildId(storageKey));

  const { data, loading, error, refetch } = useQuery<MyGuildsQueryResult>(MY_GUILDS_QUERY, {
    skip: !!mockData,
  });

  const guilds = useMemo(() => {
    if (mockData) return mockData;
    return (data?.listUserGuilds || [])
      .filter((item): item is PlainGuildSummary => !!item)
      .map((item) => GuildSummary.from(item));
  }, [mockData, data]);

  const guild = useMemo(() => {
    if (guildId) return guilds.find((item) => item.id === guildId);
    return guilds.find((item) => item.id === lastGuildId) || guilds[0];
  }, [guilds, guildId, lastGuildId]);

  const routeGuildId = guildId && guild ? guild.id : undefined;

  useEffect(() => {
    if (!routeGuildId) return;
    writeLastGuildId(routeGuildId, storageKey);
    setLastGuildId(routeGuildId);
  }, [routeGuildId, storageKey]);

  const { pathname } = location;
  const switchGuild = useCallback(
    (id: string) => {
      writeLastGuildId(id, storageKey);
      setLastGuildId(id);
      navigate(getGuildPath(id, pathname, guildId));
    },
    [storageKey, navigate, getGuildPath, pathname, guildId]
  );

  const refetchGuilds = useCallback(() => {
    if (mockData) return;
    refetch();
  }, [mockData, refetch]);

  return {
    guild,
    guilds,
    guildId,
    loading: mockData ? false : loading,
    error: mockData ? undefined : error?.message,
    switchGuild,
    refetch: mockData ? noop : refetchGuilds,
  };
}
