import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Heading } from './heading.js';
import styles from './heading.compositions.module.scss';

export const HeadingLevels = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <Heading level={1}>Pilot your guild</Heading>
        <Heading level={2}>Server health overview</Heading>
        <Heading level={3}>Moderation queue</Heading>
        <Heading level={4}>Open tickets</Heading>
        <Heading level={5}>Recent audit events</Heading>
        <Heading level={6}>Channel settings</Heading>
      </div>
    </MockProvider>
  );
};

export const HeadingWeightsAndMuted = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <Heading level={3} weight="regular">Regular weight</Heading>
        <Heading level={3} weight="medium">Medium weight</Heading>
        <Heading level={3} weight="semi-bold">Semi-bold weight</Heading>
        <Heading level={3} weight="bold">Bold weight</Heading>
        <Heading level={3} weight="extra-bold">Extra-bold weight</Heading>
        <Heading level={3} muted>Muted heading for secondary sections</Heading>
      </div>
    </MockProvider>
  );
};

export const HeadingPageHeader = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <Heading level={1} weight="extra-bold">Overview</Heading>
        <Heading level={2} size={5} weight="regular" muted>
          A semantic h2 rendered at a smaller visual size.
        </Heading>
        <Heading level={3} align="center" truncate>
          Centered heading that truncates when the text is too long for its container to display
        </Heading>
      </div>
    </MockProvider>
  );
};
