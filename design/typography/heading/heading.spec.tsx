import React from 'react';
import { render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Heading } from './heading.js';
import styles from './heading.module.scss';

describe('Heading', () => {
  it('renders the children', () => {
    const { container } = render(
      <MockProvider>
        <Heading>Hello guild</Heading>
      </MockProvider>
    );
    const heading = container.querySelector(`.${styles.heading}`);
    expect(heading?.textContent).toBe('Hello guild');
  });

  it('renders a semantic element for each level', () => {
    const levels = [1, 2, 3, 4, 5, 6] as const;
    for (const level of levels) {
      const { container, unmount } = render(
        <MockProvider>
          <Heading level={level}>Title</Heading>
        </MockProvider>
      );
      const heading = container.querySelector(`.${styles.heading}`);
      expect(heading?.tagName).toBe(`H${level}`);
      unmount();
    }
  });

  it('defaults to an h2', () => {
    const { container } = render(
      <MockProvider>
        <Heading>Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`h2.${styles.heading}`)).toBeTruthy();
  });

  it('applies the muted class', () => {
    const { container } = render(
      <MockProvider>
        <Heading muted>Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.muted}`)).toBeTruthy();
  });

  it('does not apply the muted class by default', () => {
    const { container } = render(
      <MockProvider>
        <Heading>Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.muted}`)).toBeNull();
  });

  it('applies the weight class', () => {
    const { container } = render(
      <MockProvider>
        <Heading weight="extra-bold">Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.weightExtraBold}`)).toBeTruthy();
  });

  it('uses the size prop independently of the level', () => {
    const { container } = render(
      <MockProvider>
        <Heading level={1} size={6}>Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`h1.${styles.sizeSix}`)).toBeTruthy();
  });

  it('applies truncate and align classes', () => {
    const { container } = render(
      <MockProvider>
        <Heading truncate align="center">Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.truncate}.${styles.alignCenter}`)).toBeTruthy();
  });

  it('applies a custom class name', () => {
    const { container } = render(
      <MockProvider>
        <Heading className="custom">Title</Heading>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.heading}.custom`)).toBeTruthy();
  });
});
