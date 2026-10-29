import React, { useState } from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Tabs } from './tabs.js';

export const BasicTabs = () => {
  return (
    <MockProvider>
      <Tabs />
    </MockProvider>
  );
};

export const ControlledTabs = () => {
  const [value, setValue] = useState(`pending`);
  return (
    <MockProvider>
      <Tabs
        value={value}
        onChange={(next) => setValue(next)}
        items={[
          { value: `all`, label: `All`, count: 128 },
          { value: `critical`, label: `Critical`, count: 3 },
          { value: `warnings`, label: `Warnings`, count: 14 },
          { value: `pending`, label: `Pending`, count: 7 },
          { value: `resolved`, label: `Resolved`, count: 104 },
          { value: `archived`, label: `Archived`, disabled: true },
        ]}
      />
    </MockProvider>
  );
};

export const NarrowScrollable = () => {
  return (
    <MockProvider>
      <div style={{ maxWidth: 320 }}>
        <Tabs
          defaultValue={`bans`}
          items={[
            { value: `all`, label: `All events`, count: 412 },
            { value: `bans`, label: `Bans`, count: 18 },
            { value: `kicks`, label: `Kicks`, count: 31 },
            { value: `timeouts`, label: `Timeouts`, count: 57 },
            { value: `roles`, label: `Role changes`, count: 96 },
          ]}
        />
      </div>
    </MockProvider>
  );
};
