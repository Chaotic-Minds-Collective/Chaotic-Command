import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Tabs } from './tabs.js';
import styles from './tabs.module.scss';

const items = [
  { value: `all`, label: `All`, count: 12 },
  { value: `open`, label: `Open`, count: 5 },
  { value: `closed`, label: `Closed` },
];

it(`renders a tab for every item`, () => {
  const { container } = render(
    <MockProvider>
      <Tabs items={items} />
    </MockProvider>,
  );
  expect(container.querySelectorAll(`.${styles.tab}`).length).toBe(3);
});

it(`renders counts only when provided`, () => {
  const { container } = render(
    <MockProvider>
      <Tabs items={items} />
    </MockProvider>,
  );
  const counts = container.querySelectorAll(`.${styles.count}`);
  expect(counts.length).toBe(2);
  expect(counts[0].textContent).toBe(`12`);
});

it(`marks the controlled value as active`, () => {
  const { container } = render(
    <MockProvider>
      <Tabs items={items} value="open" />
    </MockProvider>,
  );
  const tabs = container.querySelectorAll(`.${styles.tab}`);
  expect(tabs[1].classList.contains(styles.active)).toBe(true);
  expect(tabs[0].classList.contains(styles.active)).toBe(false);
});

it(`calls onChange without changing a controlled value`, () => {
  const onChange = vi.fn();
  const { container } = render(
    <MockProvider>
      <Tabs items={items} value="all" onChange={onChange} />
    </MockProvider>,
  );
  fireEvent.click(container.querySelectorAll(`.${styles.tab}`)[2]);
  expect(onChange).toHaveBeenCalledWith(`closed`);
  const tabs = container.querySelectorAll(`.${styles.tab}`);
  expect(tabs[0].classList.contains(styles.active)).toBe(true);
});

it(`manages its own selection when uncontrolled`, () => {
  const { container } = render(
    <MockProvider>
      <Tabs items={items} />
    </MockProvider>,
  );
  fireEvent.click(container.querySelectorAll(`.${styles.tab}`)[1]);
  const tabs = container.querySelectorAll(`.${styles.tab}`);
  expect(tabs[1].classList.contains(styles.active)).toBe(true);
});
