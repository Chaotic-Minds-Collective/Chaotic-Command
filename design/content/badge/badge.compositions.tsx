import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Badge } from './badge.js';
import styles from './badge-compositions.module.scss';

export const Tones = () => {
  return (
    <MockProvider>
      <div className={styles.stage}>
        <div className={styles.row}>
          <Badge tone="critical">Critical</Badge>
          <Badge tone="warning">Pending</Badge>
          <Badge tone="info">Upgrade</Badge>
          <Badge tone="success">Resolved</Badge>
          <Badge tone="neutral">Closed</Badge>
        </div>
      </div>
    </MockProvider>
  );
};

export const WithDot = () => {
  return (
    <MockProvider>
      <div className={styles.stage}>
        <div className={styles.row}>
          <Badge tone="critical" variant="dot">Raid detected</Badge>
          <Badge tone="warning" variant="dot">Slow mode</Badge>
          <Badge tone="brand" variant="dot">Open</Badge>
          <Badge tone="success" variant="dot">Online</Badge>
          <Badge tone="neutral" variant="dot">Idle</Badge>
        </div>
      </div>
    </MockProvider>
  );
};

export const Counts = () => {
  return (
    <MockProvider>
      <div className={styles.stage}>
        <div className={styles.row}>
          <Badge tone="critical" variant="count" count={4} />
          <Badge tone="warning" variant="count" count={12} />
          <Badge tone="info" variant="count" count={37} />
          <Badge tone="success" variant="count" count={8} />
          <Badge tone="neutral" variant="count" count={250} max={99} />
        </div>
      </div>
    </MockProvider>
  );
};
