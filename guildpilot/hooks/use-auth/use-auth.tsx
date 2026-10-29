import { useCallback, useMemo, useState } from 'react';
import { gql } from '@apollo/client';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { User } from '@chaotic-minds/guildpilot.entities.user';
import type { PlainUser } from '@chaotic-minds/guildpilot.entities.user';

const USER_FIELDS = `
  id
  discordId
  username
  globalName
  avatarUrl
  email
  createdAt
`;

const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    getCurrentUser {
      ${USER_FIELDS}
    }
  }
`;

const LOGIN_WITH_DISCORD = gql`
  mutation LoginWithDiscord($options: LoginWithDiscordOptions) {
    loginWithDiscord(options: $options) {
      ${USER_FIELDS}
    }
  }
`;

const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const DEFAULT_SCOPES = ['identify', 'email', 'guilds'];
const DEFAULT_CALLBACK_PATH = '/auth/callback';

/**
 * send cookies along with every auth request.
 */
const CREDENTIALS_CONTEXT = { fetchOptions: { credentials: 'include' as const } };

export type UseAuthOptions = {
  /**
   * Discord application client id. When omitted, `loginUrl` points to a mock login flow.
   */
  clientId?: string;

  /**
   * OAuth redirect uri. Defaults to the `/auth/callback` path of the current origin.
   */
  redirectUri?: string;

  /**
   * OAuth scopes to request. Defaults to identify, email and guilds.
   */
  scopes?: string[];

  /**
   * opaque OAuth state value added to the authorize url.
   */
  state?: string;

  /**
   * mock data for the current user. When provided (including `null` for a signed-out visitor),
   * the current-user query is skipped.
   */
  mockData?: User | null;
};

export type UseAuthResult = {
  /**
   * the signed-in user, or undefined when signed out.
   */
  user?: User;

  /**
   * true while the current user is loading or an auth request is in flight.
   */
  loading: boolean;

  /**
   * the last auth error, if any.
   */
  error?: Error;

  /**
   * the Discord OAuth authorize url, or a mock login url when no client id is configured.
   */
  loginUrl: string;

  /**
   * true when no Discord client id is configured and mock login should be used.
   */
  isMock: boolean;

  /**
   * exchange a Discord OAuth code for a session.
   */
  login: (code: string) => Promise<User | undefined>;

  /**
   * sign in with mock credentials, for local development without Discord.
   */
  mockLogin: (username: string, password: string) => Promise<User | undefined>;

  /**
   * end the current session.
   */
  logout: () => Promise<void>;
};

function resolveRedirectUri(redirectUri?: string): string {
  if (redirectUri) return redirectUri;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${DEFAULT_CALLBACK_PATH}`;
}

/**
 * manages GuildPilot authentication: the current user, the Discord OAuth login url,
 * code exchange login, a mock credentials login, and logout.
 * all requests are sent with credentials so the session cookie is kept.
 * @param options optional OAuth configuration and mock data.
 * @returns the user, loading state, login url and auth actions.
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const { clientId, redirectUri, scopes = DEFAULT_SCOPES, state, mockData } = options;
  const client = useApolloClient();
  const hasMockData = mockData !== undefined;
  const [override, setOverride] = useState<User | null | undefined>(undefined);
  const [actionError, setActionError] = useState<Error | undefined>(undefined);

  const { data, loading: queryLoading, error: queryError } = useQuery<{
    getCurrentUser: PlainUser | null;
  }>(GET_CURRENT_USER, {
    skip: hasMockData,
    context: CREDENTIALS_CONTEXT,
  });

  const [loginMutation, { loading: loginLoading }] = useMutation<{
    loginWithDiscord: PlainUser | null;
  }>(LOGIN_WITH_DISCORD);

  const [logoutMutation, { loading: logoutLoading }] = useMutation<{ logout: boolean | null }>(LOGOUT);

  const queryUser = useMemo(
    () => (data?.getCurrentUser ? User.from(data.getCurrentUser) : undefined),
    [data]
  );

  const resolvedRedirectUri = resolveRedirectUri(redirectUri);
  const scopeKey = scopes.join(' ');
  const isMock = !clientId;

  const loginUrl = useMemo(() => {
    if (!clientId) {
      return `${resolvedRedirectUri}?mock=1`;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: resolvedRedirectUri,
      response_type: 'code',
      scope: scopeKey,
    });
    if (state) params.set('state', state);
    return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
  }, [clientId, resolvedRedirectUri, scopeKey, state]);

  const exchangeCode = useCallback(
    async (code: string) => {
      setActionError(undefined);
      try {
        const result = await loginMutation({
          variables: { options: { code, redirectUri: resolvedRedirectUri } },
          context: CREDENTIALS_CONTEXT,
        });
        const plain = result.data?.loginWithDiscord;
        const loggedIn = plain ? User.from(plain) : undefined;
        setOverride(loggedIn ?? null);
        return loggedIn;
      } catch (err) {
        const failure = err instanceof Error ? err : new Error(String(err));
        setActionError(failure);
        throw failure;
      }
    },
    [loginMutation, resolvedRedirectUri]
  );

  const login = useCallback((code: string) => exchangeCode(code), [exchangeCode]);

  const mockLogin = useCallback(
    (username: string, password: string) =>
      exchangeCode(`mock:${encodeURIComponent(username)}:${encodeURIComponent(password)}`),
    [exchangeCode]
  );

  const logout = useCallback(async () => {
    setActionError(undefined);
    try {
      await logoutMutation({ context: CREDENTIALS_CONTEXT });
    } catch (err) {
      setActionError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setOverride(null);
      await client.clearStore();
    }
  }, [logoutMutation, client]);

  let user: User | undefined;
  if (override !== undefined) {
    user = override ?? undefined;
  } else if (hasMockData) {
    user = mockData ?? undefined;
  } else {
    user = queryUser;
  }

  return {
    user,
    loading: queryLoading || loginLoading || logoutLoading,
    error: actionError ?? queryError,
    loginUrl,
    isMock,
    login,
    mockLogin,
    logout,
  };
}
