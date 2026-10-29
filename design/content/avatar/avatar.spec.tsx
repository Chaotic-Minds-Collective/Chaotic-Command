import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Avatar } from './avatar.js';
import styles from './avatar.module.scss';

const IMAGE = `https://example.com/avatar.png`;

it('renders the image when src is provided', () => {
  const { container } = render(
    <MockProvider>
      <Avatar src={IMAGE} name="Nova Cat" />
    </MockProvider>
  );
  const image = container.querySelector(`.${styles.image}`) as HTMLImageElement;
  expect(image.src.includes(`example.com/avatar.png`)).toBe(true);
  expect(container.querySelector(`.${styles.initials}`)).toBeNull();
});

it('renders initials when there is no src', () => {
  const { container } = render(
    <MockProvider>
      <Avatar name="Mira Solano" />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.initials}`)?.textContent).toBe(`MS`);
});

it('uses two letters for a single word name', () => {
  const { container } = render(
    <MockProvider>
      <Avatar name="orion" />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.initials}`)?.textContent).toBe(`OR`);
});

it('falls back to initials when the image fails to load', () => {
  const { container } = render(
    <MockProvider>
      <Avatar src={IMAGE} name="Kai Tanaka" />
    </MockProvider>
  );
  fireEvent.error(container.querySelector(`.${styles.image}`) as HTMLImageElement);
  expect(container.querySelector(`.${styles.image}`)).toBeNull();
  expect(container.querySelector(`.${styles.initials}`)?.textContent).toBe(`KT`);
});

it('applies the size and shape classes', () => {
  const { container } = render(
    <MockProvider>
      <Avatar name="GuildPilot HQ" size="xl" shape="square" />
    </MockProvider>
  );
  const root = container.querySelector(`.${styles.avatar}`);
  expect(root?.classList.contains(styles.xl)).toBe(true);
  expect(root?.classList.contains(styles.square)).toBe(true);
});

it('renders the status dot only when a status is provided', () => {
  const { container, rerender } = render(
    <MockProvider>
      <Avatar name="Nova Cat" />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.status}`)).toBeNull();

  rerender(
    <MockProvider>
      <Avatar name="Nova Cat" status="dnd" />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.status}.${styles.dnd}`)).not.toBeNull();
});

it('merges a custom class name', () => {
  const { container } = render(
    <MockProvider>
      <Avatar name="Nova Cat" className="custom" />
    </MockProvider>
  );
  expect(container.querySelector(`.${styles.avatar}.custom`)).not.toBeNull();
});
