import React from 'react';
import { render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Paragraph } from './paragraph.js';
import styles from './paragraph.module.scss';

describe('Paragraph', () => {
  it('renders its children in a p element', () => {
    const { container } = render(
      <MockProvider>
        <Paragraph>Hello guild</Paragraph>
      </MockProvider>
    );
    const element = container.querySelector(`p.${styles.paragraph}`);
    expect(element?.textContent).toBe('Hello guild');
  });

  it('uses md size and default tone by default', () => {
    const { container } = render(
      <MockProvider>
        <Paragraph>Text</Paragraph>
      </MockProvider>
    );
    const element = container.querySelector(`.${styles.paragraph}`);
    expect(element?.classList.contains(styles.md)).toBe(true);
    expect(element?.classList.contains(styles.default)).toBe(true);
  });

  it('applies the size class', () => {
    const { container } = render(
      <MockProvider>
        <Paragraph size="lg">Text</Paragraph>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.lg}`)).toBeTruthy();
    expect(container.querySelector(`.${styles.md}`)).toBeNull();
  });

  it('applies the tone class', () => {
    const { container } = render(
      <MockProvider>
        <Paragraph tone="danger">Text</Paragraph>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.danger}`)).toBeTruthy();
  });

  it('applies a custom class name', () => {
    const { container } = render(
      <MockProvider>
        <Paragraph className="custom">Text</Paragraph>
      </MockProvider>
    );
    expect(container.querySelector('p.custom')).toBeTruthy();
  });
});
