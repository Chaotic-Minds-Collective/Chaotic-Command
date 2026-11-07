// Supabase REST storage - shares state with the Chaotic Command web app.
// Tables: bot_guilds (per-guild config), bot_tickets, bot_pending (drafts).

export function createStore(env, fetcher = fetch) {
  const base = `${env.SUPABASE_URL}`.replace(/\/$/, '');
  const headers = () => ({
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  });

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

  const getConfig = async (guildId) => {
    const { data } = await request('GET', `/rest/v1/bot_guilds?guild_id=eq.${guildId}&select=config&limit=1`);
    return data?.[0]?.config ?? null;
  };

  const saveConfig = (guildId, config) =>
    request('POST', '/rest/v1/bot_guilds', { guild_id: guildId, config }, { Prefer: 'resolution=merge-duplicates' });

  const createTicket = (row) => request('POST', '/rest/v1/bot_tickets', row);

  const getTicket = async (ticketId) => {
    const { data } = await request('GET', `/rest/v1/bot_tickets?id=eq.${ticketId}&select=*&limit=1`);
    return data?.[0] ?? null;
  };

  const updateTicket = (ticketId, patch) => request('PATCH', `/rest/v1/bot_tickets?id=eq.${ticketId}`, patch);

  const countTickets = async (guildId) => {
    const { data } = await request('GET', `/rest/v1/bot_tickets?guild_id=eq.${guildId}&select=id`);
    return data?.length ?? 0;
  };

  const savePending = (id, payload) => request('POST', '/rest/v1/bot_pending', { id, payload });
  const getPending = async (id) => (await request('GET', `/rest/v1/bot_pending?id=eq.${id}&select=payload&limit=1`)).data?.[0]?.payload ?? null;
  const deletePending = (id) => request('DELETE', `/rest/v1/bot_pending?id=eq.${id}`);

  return { getConfig, saveConfig, createTicket, getTicket, updateTicket, countTickets, savePending, getPending, deletePending };
}
