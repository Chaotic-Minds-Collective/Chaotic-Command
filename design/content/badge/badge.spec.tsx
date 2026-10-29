import React from 'react';
import { render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Badge } from './badge.js';
import styles from './badge.module.scss';

it(`should render the label`, () => {
  const { container } = render(
    <MockProvider>
      <Badge tone="critical">Critical</Badge>
    </MockProvider>
  );
  const label = container.querySelector(`.${styles.label}`);
  expect(label?.textContent).toBe(`Critical`);
});

it(`should apply the tone class`, () => {
  const { container } = render(
    <MockProvider>
      <Badge tone="warning">Pending</Badge>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.badge}`)?.classList.contains(styles.warning)).toBe(true);
});

it(`should use the info style for the brand tone`, () => {
  const { container } = render(
    <MockProvider>
      <Badge tone="brand">Open</Badge>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.badge}`)?.classList.contains(styles.info)).toBe(true);
});

it(`should render a dot in the dot variant`, () => {
  const { container } = render(
    <MockProvider>
      <Badge variant="dot">Online</Badge>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.dot}`)).toBeTruthy();
});

it(`should not render a dot in the label variant`, () => {
  const { container } = render(
    <MockProvider>
      <Badge>Online</Badge>
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.dot}`)).toBeNull();
});

it(`should render the count`, () => {
  const { container } = render(
    <MockProvider>
      <Badge variant="count" count={7} />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.countValue}`)?.textContent).toBe(`7`);
});

it(`should cap the count at max`, () => {
  const { container } = render(
    <MockProvider>
      <Badge variant="count" count={250} max={99} />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.countValue}`)?.textContent).toBe(`99+`);
});

it(`should hide a zero count when hideZero is set`, () => {
  const { container } = render(
    <MockProvider>
      <Badge variant="count" count={0} hideZero />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.badge}`)).toBeNull();
});
