import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { servers } from './mock-data.js';
import { Layout } from './layout.js';
import { OverviewPage } from './overview-page.js';
import { SetupPage } from './setup-page.js';
import { AuditPage } from './audit-page.js';
import { TicketsPage } from './tickets-page.js';
import { ModerationPage } from './moderation-page.js';
import { SettingsPage } from './settings-page.js';

/**
 * GuildPilot prototype — Discord server setup, audit and management command center.
 */
export function GuildpilotPrototype() {
  const [serverId, setServerId] = useState(servers[0].id);
  const server = servers.find((s) => s.id === serverId)!;
  return (
    <Layout serverId={serverId} onServerChange={setServerId}>
      <Routes>
        <Route path="/" element={<OverviewPage server={server} />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/audit" element={<AuditPage key={server.id} server={server} />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/moderation" element={<ModerationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
