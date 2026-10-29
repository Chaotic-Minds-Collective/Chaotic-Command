import type { DropdownItemType } from './dropdown-item-type.js';

export const defaultDropdownItems: DropdownItemType[] = [
  { id: `view`, label: `View profile` },
  { id: `warn`, label: `Warn member` },
  { id: `timeout`, label: `Timeout` },
  { id: `ban`, label: `Ban member`, danger: true, divider: true },
];
