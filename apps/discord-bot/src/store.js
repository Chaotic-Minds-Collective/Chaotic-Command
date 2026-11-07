// Supabase REST storage - shares state with the Chaotic Command web app.
// Tables: bot_guilds (per-guild config), bot_tickets, bot_pending (drafts).

/** Create the Supabase REST store for guild config, tickets, and pending drafts. */
export function createStore(env, fetcher = fetch) {
  const base = `${env.SUPABASE_URL}`.replace(/\/$/, '');
  const headers = () => ({
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  });

  /** Perform one Supabase REST call and return {status, data}. */
  async function request(method, path, body, extraHeaders = {}) {
    const response = await fetcher(`${base}${path}`, {
      method,
      headers: { ...headers(), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: response.status, data };
  }

  /** Read a guild's stored config, or null when none exists. */
  const getConfig = async (guildId) => {
    const { data } = await request('GET', `/rest/v1/bot_guilds?guild_id=eq.${guildId}&select=config&limit=1`);
    return data?.[0]?.config ?? null;
  };

  /** Upsert a guild's config row. */
  const saveConfig = (guildId, config) =>
    request('POST', '/rest/v1/bot_guilds', { guild_id: guildId, config }, { Prefer: 'resolution=merge-duplicates' });

  /** Insert a new ticket row. */
  const createTicket = (row) => request('POST', '/rest/v1/bot_tickets', row);

  /** Read one ticket by id, or null when missing. */
  const getTicket = async (ticketId) => {
    const { data } = await request('GET', `/rest/v1/bot_tickets?id=eq.${ticketId}&select=*&limit=1`);
    return data?.[0] ?? null;
  };

  /** Patch a ticket row's mutable fields. */
  const updateTicket = (ticketId, patch) => request('PATCH', `/rest/v1/bot_tickets?id=eq.${ticketId}`, patch);

  /** Count a guild's tickets, used for sequential channel numbering. */
  const countTickets = async (guildId) => {
    const { data } = await request('GET', `/rest/v1/bot_tickets?guild_id=eq.${guildId}&select=id`);
    return data?.length ?? 0;
  };

  /** Store a pending announcement draft keyed by a random id. */
  const savePending = (id, payload) => request('POST', '/rest/v1/bot_pending', { id, payload });
  /** Read a pending draft's payload, or null when expired or missing. */
  const getPending = async (id) => (await request('GET', `/rest/v1/bot_pending?id=eq.${id}&select=payload&limit=1`)).data?.[0]?.payload ?? null;
  /** Delete a pending draft after posting or discarding it. */
  const deletePending = (id) => request('DELETE', `/rest/v1/bot_pending?id=eq.${id}`);

  return { getConfig, saveConfig, createTicket, getTicket, updateTicket, countTickets, savePending, getPending, deletePending };
}
