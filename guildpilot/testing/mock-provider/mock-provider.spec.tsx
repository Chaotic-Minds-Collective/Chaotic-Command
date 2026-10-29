import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MockProvider } from './mock-provider.js';
import { useIsMock } from './use-is-mock.js';

function Probe() {
  const isMock = useIsMock();
  const { pathname } = useLocation();
  return (
    <span className="probe">
      {String(isMock)}|{pathname}
    </span>
  );
}

describe('MockProvider', () => {
  it('renders its children', () => {
    const { container } = render(
      <MockProvider>
        <span className="child">hello guild</span>
      </MockProvider>
    );
    expect(container.querySelector('.child')?.textContent).toBe('hello guild');
  });

  it('flags the mock context', () => {
    const { container } = render(
      <MockProvider>
        <Probe />
      </MockProvider>
    );
    expect(container.querySelector('.probe')?.textContent?.startsWith('true')).toBe(true);
  });

  it('applies initialEntries to the router', () => {
    const { container } = render(
      <MockProvider initialEntries={['/guilds/42/tickets']}>
        <Probe />
      </MockProvider>
    );
    expect(container.querySelector('.probe')?.textContent?.includes('/guilds/42/tickets')).toBe(true);
  });

  it('skips the router when noRouter is set', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/outer']}>
        <MockProvider noRouter>
          <Probe />
        </MockProvider>
      </MemoryRouter>
    );
    expect(container.querySelector('.probe')?.textContent?.includes('/outer')).toBe(true);
  });

  it('renders children without the theme when noTheme is set', () => {
    const { container } = render(
      <MockProvider noTheme>
        <span className="child">plain</span>
      </MockProvider>
    );
    expect(container.querySelector('.child')).toBeTruthy();
  });
});
