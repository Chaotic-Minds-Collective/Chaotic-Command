import React from 'react';
import { vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Dropdown } from './dropdown.js';
import styles from './dropdown.module.scss';

const items = [
  { id: `a`, label: `Alpha` },
  { id: `b`, label: `Beta`, disabled: true },
  { id: `c`, label: `Gamma`, danger: true, divider: true },
];

describe(`Dropdown`, () => {
  it(`renders the trigger and keeps the menu closed`, () => {
    const { container } = render(
      <MockProvider>
        <Dropdown trigger="Open" items={items} />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.trigger}`)?.textContent).toContain(`Open`);
    expect(container.querySelector(`.${styles.menu}`)).toBeNull();
  });

  it(`opens the menu on trigger click`, () => {
    const { container } = render(
      <MockProvider>
        <Dropdown items={items} />
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.trigger}`) as HTMLElement);
    expect(container.querySelectorAll(`.${styles.item}`).length).toBe(3);
    expect(container.querySelectorAll(`.${styles.divider}`).length).toBe(1);
  });

  it(`marks danger items`, () => {
    const { container } = render(
      <MockProvider>
        <Dropdown items={items} />
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.trigger}`) as HTMLElement);
    expect(container.querySelectorAll(`.${styles.danger}`).length).toBe(1);
  });

  it(`calls onSelect and closes when an item is clicked`, () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MockProvider>
        <Dropdown items={items} onSelect={onSelect} />
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.trigger}`) as HTMLElement);
    fireEvent.click(container.querySelector(`.${styles.item}`) as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(`a`);
    expect(container.querySelector(`.${styles.menu}`)).toBeNull();
  });

  it(`skips disabled items with the arrow keys`, () => {
    const { container } = render(
      <MockProvider>
        <Dropdown items={items} />
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.trigger}`) as HTMLElement);
    const menu = container.querySelector(`[role="menu"]`) as HTMLElement;
    fireEvent.keyDown(menu, { key: `ArrowDown` });
    const active = container.querySelector(`.${styles.active}`);
    expect(active?.textContent).toContain(`Gamma`);
  });

  it(`closes on Escape`, () => {
    const { container } = render(
      <MockProvider>
        <Dropdown items={items} />
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.trigger}`) as HTMLElement);
    fireEvent.keyDown(container.querySelector(`[role="menu"]`) as HTMLElement, { key: `Escape` });
    expect(container.querySelector(`.${styles.menu}`)).toBeNull();
  });

  it(`opens with ArrowDown from the trigger`, () => {
    const { container } = render(
      <MockProvider>
        <Dropdown items={items} />
      </MockProvider>
    );
    fireEvent.keyDown(container.querySelector(`.${styles.trigger}`) as HTMLElement, { key: `ArrowDown` });
    expect(container.querySelector(`.${styles.menu}`)).not.toBeNull();
  });
});
