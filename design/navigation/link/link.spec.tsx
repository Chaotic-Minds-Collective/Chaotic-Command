import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Link } from './link.js';
import styles from './link.module.scss';

describe(`Link`, () => {
  it(`renders its children with the href`, () => {
    const { container } = render(
      <MockProvider>
        <Link href="/docs">Docs</Link>
      </MockProvider>
    );
    const link = container.querySelector(`.${styles.link}`) as HTMLAnchorElement;
    expect(link.textContent).toContain(`Docs`);
    expect(link.getAttribute(`href`)).toBe(`/docs`);
  });

  it(`applies the variant class`, () => {
    const { container } = render(
      <MockProvider>
        <Link href="/docs" variant="nav">
          Docs
        </Link>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.nav}`)).toBeTruthy();
  });

  it(`marks the active link`, () => {
    const { container } = render(
      <MockProvider>
        <Link href="/docs" active>
          Docs
        </Link>
      </MockProvider>
    );
    const link = container.querySelector(`.${styles.active}`) as HTMLAnchorElement;
    expect(link.getAttribute(`aria-current`)).toBe(`page`);
  });

  it(`handles absolute urls as external links`, () => {
    const { container } = render(
      <MockProvider>
        <Link href="https://example.com">Example</Link>
      </MockProvider>
    );
    const link = container.querySelector(`.${styles.link}`) as HTMLAnchorElement;
    expect(link.getAttribute(`target`)).toBe(`_blank`);
    expect(link.getAttribute(`rel`)).toContain(`noopener`);
    expect(container.querySelector(`.${styles.externalIcon}`)).toBeTruthy();
  });

  it(`hides the external icon on request`, () => {
    const { container } = render(
      <MockProvider>
        <Link href="https://example.com" hideExternalIcon>
          Example
        </Link>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.externalIcon}`)).toBeNull();
  });

  it(`calls onNavigate for internal clicks`, () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <MockProvider>
        <Link href="/tickets" onNavigate={(to) => onNavigate(to)}>
          Tickets
        </Link>
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.link}`) as HTMLAnchorElement);
    expect(onNavigate).toHaveBeenCalledWith(`/tickets`);
  });

  it(`does not call onNavigate for external links`, () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <MockProvider>
        <Link href="https://example.com" onNavigate={(to) => onNavigate(to)}>
          Example
        </Link>
      </MockProvider>
    );
    fireEvent.click(container.querySelector(`.${styles.link}`) as HTMLAnchorElement);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it(`renders icon and badge`, () => {
    const { container } = render(
      <MockProvider>
        <Link href="/tickets" variant="nav" icon="🎫" badge="3">
          Tickets
        </Link>
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.icon}`)).toBeTruthy();
    expect(container.querySelector(`.${styles.badge}`)?.textContent).toBe(`3`);
  });
});
