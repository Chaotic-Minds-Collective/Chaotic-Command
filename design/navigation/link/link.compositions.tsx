import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Link } from './link.js';
import styles from './link.compositions.module.scss';

export const Variants = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <Link href="/docs">Default link</Link>
        <Link href="/docs" variant="muted">
          Muted link
        </Link>
        <Link href="/docs" variant="default" active>
          Active default link
        </Link>
      </div>
    </MockProvider>
  );
};

export const SidebarNavigation = () => {
  return (
    <MockProvider>
      <nav className={styles.sidebar}>
        <Link href="/" variant="nav" icon="📊" active>
          Overview
        </Link>
        <Link href="/setup" variant="nav" icon="🧱">
          Server Setup
        </Link>
        <Link href="/tickets" variant="nav" icon="🎫" badge="3">
          Tickets
        </Link>
        <Link href="/moderation" variant="nav" icon="🛡️">
          Moderation
        </Link>
      </nav>
    </MockProvider>
  );
};

export const ExternalLinks = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <Link href="https://discord.com/developers/docs">Discord developer docs</Link>
        <Link href="https://status.discord.com" variant="muted">
          Discord status
        </Link>
        <Link href="/internal-page" external hideExternalIcon>
          Forced external, no icon
        </Link>
      </div>
    </MockProvider>
  );
};
