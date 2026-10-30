const $ = id => document.getElementById(id);
let csrf, selected = '', plan, busy = false;
async function api(path, body) {
  const response = await fetch(path, { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { $('workspace').hidden = true; $('login').hidden = false; }
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}
function message(text) { $('message').textContent = text; }
function clearPlan() { plan = null; $('plan').hidden = true; $('confirmation').value = ''; $('result').textContent = ''; }
function controls(disabled) { document.querySelectorAll('button, select, input, textarea').forEach(el => { el.disabled = disabled; }); }
async function run(action) {
  if (busy) return;
  busy = true; controls(true); message('Working…');
  try { await action(); } catch (error) { message(error.message); }
  finally { busy = false; controls(false); }
}
function options(el, items, placeholder) {
  el.replaceChildren();
  if (placeholder) el.add(new Option(placeholder, ''));
  items.forEach(item => el.add(new Option(item.name, item.id)));
}
function requireGuild() { if (!selected) throw new Error('Choose a server first.'); }
async function loadGuilds() {
  clearPlan(); selected = ''; $('notes').value = ''; $('status').textContent = ''; $('invite').removeAttribute('href');
  const data = await api('/api/guilds');
  options($('guild'), data.guilds, 'Choose a server');
  message(data.guilds.length ? 'Select a server to begin.' : 'No manageable servers found. You need Manage Server permission in Discord.');
}
async function loadServer() {
  clearPlan(); selected = $('guild').value; $('notes').value = ''; $('status').textContent = ''; $('invite').removeAttribute('href');
  if (!selected) { message('Choose a server.'); return; }
  const notes = await api(`/api/guilds/${selected}/notes`); $('notes').value = notes.notes;
  try {
    const status = await api(`/api/guilds/${selected}/status`);
    $('status').textContent = `Bot ready. ${status.channels} channels and ${status.roles} roles on this server.`;
    $('invite').href = status.inviteUrl;
    message('Ready. Preview a template before making changes.');
  } catch (error) {
    $('status').textContent = error.message;
    message('Bot not ready. Use the installation link below, then reselect this server.');
    // Public invite endpoint is provided by the session response, not derived from secrets.
    if (window.commandInviteBase) $('invite').href = `${window.commandInviteBase}&guild_id=${selected}&disable_guild_select=true`;
  }
}
$('refresh').onclick = () => run(loadGuilds);
$('guild').onchange = () => run(loadServer);
$('template').onchange = clearPlan;
$('logout').onclick = () => run(async () => {
  if (!window.confirm('Sign out of Chaotic Command?')) { message('Sign-out cancelled.'); return; }
  await api('/api/logout', {}); location.reload();
});
$('preview').onclick = () => run(async () => {
  requireGuild(); clearPlan();
  plan = await api(`/api/guilds/${selected}/preview`, { templateId: $('template').value });
  $('steps').replaceChildren(...plan.steps.map(step => {
    const li = document.createElement('li');
    li.textContent = `${step.existingId ? 'Reuse' : 'Create'} ${step.kind}: ${step.name}${step.category ? ` (in ${step.category})` : ''}`;
    if (step.kind === 'role' && step.existingId) {
      const detail = document.createElement('small');
      detail.textContent = step.permissionFlags?.length
        ? `Existing permissions: ${step.permissionFlags.join(', ')}${step.elevatedPermissions ? ' — REVIEW: elevated permissions' : ''}`
        : 'Existing permissions: none';
      detail.className = step.elevatedPermissions ? 'permission-warning' : 'permission-detail';
      li.append(document.createElement('br'), detail);
    } else if (step.kind === 'role') {
      const detail = document.createElement('small');
      detail.textContent = 'New role: zero permissions; no members will be assigned.';
      detail.className = 'permission-detail';
      li.append(document.createElement('br'), detail);
    }
    return li;
  }));
  $('expiry').textContent = `Preview expires at ${new Date(plan.expires).toLocaleTimeString()}.`;
  $('confirm-label').textContent = `Type APPLY ${selected} to confirm creating the listed objects in ${$('guild').selectedOptions[0].textContent}.`;
  $('plan').hidden = false; message('Preview ready. No Discord changes have been made.');
});
$('apply').onclick = () => run(async () => {
  requireGuild();
  if (!plan || Date.now() >= plan.expires) { clearPlan(); throw new Error('Preview expired. Preview again.'); }
  if ($('confirmation').value !== `APPLY ${selected}`) throw new Error('Type the exact confirmation shown above.');
  if (!window.confirm('Create the listed roles and channels in the selected Discord server? This cannot be automatically undone.')) { message('Setup cancelled.'); return; }
  const pending = plan; plan = null; $('plan').hidden = true;
  const result = await api(`/api/guilds/${selected}/apply`, { nonce: pending.nonce, confirm: $('confirmation').value });
  $('result').textContent = result.completed.map(step => `${step.action}: ${step.kind} ${step.name} (${step.id})`).join('\n');
  message(result.error ? `Partially completed: ${result.error} Preview again to reuse completed work.` : 'Setup complete. Changes are now in Discord.');
});
$('save-notes').onclick = () => run(async () => {
  requireGuild(); await api(`/api/guilds/${selected}/notes`, { notes: $('notes').value }); message('Server notes saved.');
});
run(async () => {
  const session = await api('/api/session'); csrf = session.csrf;
  window.commandInviteBase = session.inviteBase;
  $('login').hidden = Boolean(session.user); $('workspace').hidden = !session.user;
  $('configuration').textContent = session.configured ? 'Sign in to list servers you manage.' : 'The server is running. Configure Discord credentials and SESSION_SECRET in .env, then restart to enable sign-in.';
  $('signin').hidden = !session.configured;
  if (!session.user) { message('Not connected to Discord.'); return; }
  $('user').textContent = `Signed in as ${session.user.username}`;
  options($('template'), (await api('/api/templates')).templates);
  await loadGuilds();
});
