import React from 'react';
import { useLocation } from 'react-router-dom';
import { MockProvider } from './mock-provider.js';
import { useIsMock } from './use-is-mock.js';
import styles from './mock-provider.compositions.module.css';

function ProbeCard() {
  const isMock = useIsMock();
  const { pathname } = useLocation();

  return (
    <div className={styles.card}>
      <strong className={styles.title}>GuildPilot mock context</strong>
      <span className={styles.muted}>Mock mode: {isMock ? 'enabled' : 'disabled'}</span>
      <span className={styles.pill}>{pathname}</span>
    </div>
  );
}

export const BasicMockProvider = () => {
  return (
    <MockProvider>
      <ProbeCard />
    </MockProvider>
  );
};

export const WithInitialEntries = () => {
  return (
    <MockProvider initialEntries={['/guilds/42/tickets']}>
      <ProbeCard />
    </MockProvider>
  );
};

export const LightTheme = () => {
  return (
    <MockProvider initialTheme="light" initialEntries={['/guilds/42/moderation']}>
      <ProbeCard />
    </MockProvider>
  );
};
