import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Paragraph } from './paragraph.js';

export const DefaultParagraph = () => {
  return (
    <MockProvider>
      <Paragraph />
    </MockProvider>
  );
};

export const Sizes = () => {
  return (
    <MockProvider>
      <Paragraph size="sm">Small: 12 new accounts joined in the last 30 seconds.</Paragraph>
      <Paragraph size="md">Medium: Raid protection is active in #general.</Paragraph>
      <Paragraph size="lg">Large: Your server health score improved to 92 this week.</Paragraph>
    </MockProvider>
  );
};

export const Tones = () => {
  return (
    <MockProvider>
      <Paragraph tone="default">Default: Ticket #482 is awaiting a reply.</Paragraph>
      <Paragraph tone="muted">Muted: Opened 2 hours ago by a community member.</Paragraph>
      <Paragraph tone="accent">Accent: Auto-moderation resolved 38 reports today.</Paragraph>
      <Paragraph tone="danger">Danger: Critical raid detected, lock the channel now.</Paragraph>
    </MockProvider>
  );
};
