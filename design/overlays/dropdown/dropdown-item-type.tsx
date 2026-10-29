import type React from 'react';

export type DropdownItemType = {
  /**
   * unique identifier of the item, passed to `onSelect`.
   */
  id: string;

  /**
   * text label of the item.
   */
  label: string;

  /**
   * optional icon rendered before the label.
   */
  icon?: React.ReactNode;

  /**
   * render the item with a destructive (danger) style.
   */
  danger?: boolean;

  /**
   * render a divider line above the item.
   */
  divider?: boolean;

  /**
   * disable the item.
   */
  disabled?: boolean;
};
