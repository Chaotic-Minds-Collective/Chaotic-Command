import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Spinner } from './spinner.js';
import styles from './spinner.compositions.module.scss';

export const SpinnerSizes = () => {
  return (
    <MockProvider>
      <div className={styles.row}>
        <Spinner size="small" />
        <Spinner size="medium" />
        <Spinner size="large" />
        <Spinner showLabel label="Syncing server health" />
      </div>
    </MockProvider>
  );
};

export const SkeletonLines = () => {
  return (
    <MockProvider>
      <div className={styles.card}>
        <Spinner variant="line" lines={4} label="Loading ticket" />
      </div>
    </MockProvider>
  );
};

export const SkeletonCard = () => {
  return (
    <MockProvider>
      <div className={styles.card}>
        <div className={styles.header}>
          <Spinner variant="block" circle width="48px" label="Loading avatar" />
          <div className={styles.grow}>
            <Spinner variant="line" lines={2} label="Loading title" />
          </div>
        </div>
        <Spinner variant="block" height="120px" label="Loading chart" />
      </div>
    </MockProvider>
  );
};
