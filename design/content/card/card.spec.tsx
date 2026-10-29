import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Card } from './card.js';
import styles from './card.module.scss';

it(`renders the title and children`, () => {
  const { container } = render(
    <MockProvider>
      <Card title="Server health">Body content</Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.title}`)?.textContent).toBe(`Server health`);
  expect(container.querySelector(`.${styles.body}`)?.textContent).toBe(`Body content`);
});

it(`renders the actions slot`, () => {
  const { container } = render(
    <MockProvider>
      <Card title="Title" actions={<button type="button">Act</button>}>
        Body
      </Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.actions}`)?.textContent).toBe(`Act`);
});

it(`does not render a header without title or actions`, () => {
  const { container } = render(
    <MockProvider>
      <Card>Body</Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.header}`)).toBeNull();
});

it(`applies the selected class when selectable and selected`, () => {
  const { container } = render(
    <MockProvider>
      <Card selectable selected>
        Body
      </Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.selected}`)).toBeTruthy();
});

it(`does not apply the selected class when not selectable`, () => {
  const { container } = render(
    <MockProvider>
      <Card selected>Body</Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.selected}`)).toBeNull();
});

it(`calls onSelect on click`, () => {
  const onSelect = vi.fn();
  const { container } = render(
    <MockProvider>
      <Card selectable onSelect={() => onSelect()}>
        Body
      </Card>
    </MockProvider>
  );
  fireEvent.click(container.querySelector(`.${styles.card}`) as HTMLElement);
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it(`calls onSelect on Enter key`, () => {
  const onSelect = vi.fn();
  const { container } = render(
    <MockProvider>
      <Card selectable onSelect={() => onSelect()}>
        Body
      </Card>
    </MockProvider>
  );
  fireEvent.keyDown(container.querySelector(`.${styles.card}`) as HTMLElement, { key: `Enter` });
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it(`applies the padding class`, () => {
  const { container } = render(
    <MockProvider>
      <Card padding="large">Body</Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.paddingLarge}`)).toBeTruthy();
});

it(`applies the interactive class`, () => {
  const { container } = render(
    <MockProvider>
      <Card interactive>Body</Card>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.interactive}`)).toBeTruthy();
});
