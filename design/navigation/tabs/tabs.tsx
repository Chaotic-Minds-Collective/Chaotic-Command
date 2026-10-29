import React, { useState } from 'react';
import classNames from 'classnames';
import type { TabItem } from './tab-item-type.js';
import styles from './tabs.module.scss';

export type TabsProps = {
  /**
   * tabs to render.
   */
  items?: TabItem[];

  /**
   * the selected tab value (controlled).
   * when omitted, the component manages its own selection.
   */
  value?: string;

  /**
   * the initially selected value when the component is not controlled.
   */
  defaultValue?: string;

  /**
   * called with the value of the tab the user selected.
   */
  onChange?: (value: string) => void;

  /**
   * accessible label of the tab list.
   */
  label?: string;

  /**
   * class name for the tabs container.
   */
  className?: string;

  /**
   * inline style for the tabs container.
   */
  style?: React.CSSProperties;
};

const DEFAULT_ITEMS: TabItem[] = [
  { value: `all`, label: `All`, count: 24 },
  { value: `open`, label: `Open`, count: 9 },
  { value: `pending`, label: `Pending`, count: 5 },
  { value: `closed`, label: `Closed`, count: 10 },
];

/**
 * a segmented tab filter with optional counts.
 * scrolls horizontally on narrow screens.
 */
export function Tabs({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onChange,
  label = `Filter`,
  className,
  style,
}: TabsProps) {
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : (internal ?? items[0]?.value);

  const select = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div className={classNames(styles.tabs, className)} style={style} role="tablist" aria-label={label}>
      {items.map((item) => {
        const active = item.value === current;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={classNames(styles.tab, active && styles.active)}
            onClick={() => select(item.value)}
          >
            <span className={styles.label}>{item.label}</span>
            {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
