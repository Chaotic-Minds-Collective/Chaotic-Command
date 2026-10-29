import React, { useState } from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Dropdown } from './dropdown.js';
import { AlertIcon, BanIcon, ClockIcon, UserIcon } from './dropdown-icons.js';
import type { DropdownItemType } from './dropdown-item-type.js';

const iconItems: DropdownItemType[] = [
  { id: `view`, label: `View profile`, icon: <UserIcon /> },
  { id: `warn`, label: `Warn member`, icon: <AlertIcon /> },
  { id: `timeout`, label: `Timeout`, icon: <ClockIcon /> },
  { id: `ban`, label: `Ban member`, icon: <BanIcon />, danger: true, divider: true },
];

export const BasicDropdown = () => {
  return (
    <MockProvider>
      <div style={{ minHeight: 260, padding: 24 }}>
        <Dropdown />
      </div>
    </MockProvider>
  );
};

export const WithIconsAndDanger = () => {
  const [selected, setSelected] = useState(`nothing yet`);
  return (
    <MockProvider>
      <div style={{ minHeight: 280, padding: 24 }}>
        <Dropdown trigger="Moderate" items={iconItems} onSelect={(id) => setSelected(id)} />
        <p style={{ color: `var(--colors-text-muted)` }}>Last action: {selected}</p>
      </div>
    </MockProvider>
  );
};

export const AlignedEnd = () => {
  return (
    <MockProvider>
      <div style={{ minHeight: 280, padding: 24, display: `flex`, justifyContent: `flex-end` }}>
        <Dropdown
          align="end"
          trigger="Member options"
          items={[
            ...iconItems.slice(0, 2),
            { id: `timeout`, label: `Timeout (unavailable)`, icon: <ClockIcon />, disabled: true },
            iconItems[3],
          ]}
        />
      </div>
    </MockProvider>
  );
};
