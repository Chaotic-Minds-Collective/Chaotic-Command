import React from 'react';
import { render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Spinner } from './spinner.js';
import styles from './spinner.module.scss';

describe('Spinner', () => {
  it(`renders a spinning ring by default`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.ring}`)).toBeTruthy();
    expect(container.querySelector(`.${styles.medium}`)).toBeTruthy();
  });

  it(`applies the requested size`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner size="large" />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.large}`)).toBeTruthy();
  });

  it(`shows the label when showLabel is set`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner showLabel label="Syncing" />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.label}`)?.textContent).toBe(`Syncing`);
  });

  it(`hides the label by default`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.label}`)).toBeNull();
  });

  it(`renders the requested number of skeleton lines`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner variant="line" lines={4} />
      </MockProvider>
    );
    expect(container.querySelectorAll(`.${styles.line}`).length).toBe(4);
  });

  it(`renders a skeleton block`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner variant="block" />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.block}`)).toBeTruthy();
    expect(container.querySelector(`.${styles.circle}`)).toBeNull();
  });

  it(`renders a circular block`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner variant="block" circle width="40px" />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.circle}`)).toBeTruthy();
  });

  it(`accepts a custom class name`, () => {
    const { container } = render(
      <MockProvider>
        <Spinner className="custom" />
      </MockProvider>
    );
    expect(container.querySelector(`.custom`)).toBeTruthy();
  });
});
