import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Icon } from './icon.js';
import styles from './icon.compositions.module.scss';

const SHIELD_PATH = `M12 2 L20 5 V11 C20 16 16.5 20.5 12 22 C7.5 20.5 4 16 4 11 V5 Z`;
const CHECK_PATH = `M8 12.5 L11 15.5 L16.5 9`;
const BELL_PATH = `M6 9 a6 6 0 0 1 12 0 c0 6 2 7 2 7 H4 s2 -1 2 -7 M10 20 a2 2 0 0 0 4 0`;

export const Sizes = () => {
  return (
    <MockProvider>
      <div className={styles.row}>
        <Icon size={16} className={styles.brand} title="Shield small">
          <path d={SHIELD_PATH} />
        </Icon>
        <Icon size={24} className={styles.brand} title="Shield medium">
          <path d={SHIELD_PATH} />
        </Icon>
        <Icon size={40} className={styles.brand} title="Shield large">
          <path d={SHIELD_PATH} />
        </Icon>
        <Icon size={64} className={styles.brand} title="Shield extra large">
          <path d={SHIELD_PATH} />
        </Icon>
      </div>
    </MockProvider>
  );
};

export const InheritsCurrentColor = () => {
  return (
    <MockProvider>
      <div className={styles.row}>
        <span className={`${styles.label} ${styles.mint}`}>
          <Icon outline>
            <path d={SHIELD_PATH} />
            <path d={CHECK_PATH} />
          </Icon>
          Protected
        </span>
        <span className={`${styles.label} ${styles.warning}`}>
          <Icon outline>
            <path d={BELL_PATH} />
          </Icon>
          Pending
        </span>
        <span className={`${styles.label} ${styles.danger}`}>
          <Icon>
            <path d={SHIELD_PATH} />
          </Icon>
          Critical
        </span>
      </div>
    </MockProvider>
  );
};

export const OutlineAndExplicitColor = () => {
  return (
    <MockProvider>
      <div className={styles.row}>
        <Icon outline size={32} strokeWidth={1.5} color="#5865F2" title="Thin outline">
          <path d={BELL_PATH} />
        </Icon>
        <Icon outline size={32} strokeWidth={2.5} color="#3BD6A0" title="Bold outline">
          <path d={BELL_PATH} />
        </Icon>
        <Icon size="2rem" />
      </div>
    </MockProvider>
  );
};
