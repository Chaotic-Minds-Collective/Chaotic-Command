import React from 'react';
import { render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Icon } from './icon.js';
import styles from './icon.module.scss';

describe(`Icon`, () => {
  it(`renders an svg with the icon class`, () => {
    const { container } = render(
      <MockProvider>
        <Icon>
          <path d="M0 0 L10 10" />
        </Icon>
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.classList.contains(styles.icon)).toBe(true);
  });

  it(`renders children paths`, () => {
    const { container } = render(
      <MockProvider>
        <Icon>
          <path className="custom-path" d="M0 0 L10 10" />
        </Icon>
      </MockProvider>
    );
    expect(container.querySelector(`.custom-path`)).toBeTruthy();
  });

  it(`applies the size to width and height`, () => {
    const { container } = render(
      <MockProvider>
        <Icon size={40} />
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.getAttribute(`width`)).toBe(`40`);
    expect(svg.getAttribute(`height`)).toBe(`40`);
  });

  it(`uses currentColor by default`, () => {
    const { container } = render(
      <MockProvider>
        <Icon />
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.getAttribute(`fill`)).toBe(`currentColor`);
  });

  it(`strokes instead of filling in outline mode`, () => {
    const { container } = render(
      <MockProvider>
        <Icon outline strokeWidth={3} />
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.getAttribute(`fill`)).toBe(`none`);
    expect(svg.getAttribute(`stroke`)).toBe(`currentColor`);
    expect(svg.getAttribute(`stroke-width`)).toBe(`3`);
  });

  it(`renders a title and img role when title is provided`, () => {
    const { container } = render(
      <MockProvider>
        <Icon title="Shield" />
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.querySelector(`title`)?.textContent).toBe(`Shield`);
    expect(svg.getAttribute(`role`)).toBe(`img`);
    expect(svg.getAttribute(`aria-hidden`)).toBeNull();
  });

  it(`is hidden from assistive technology without a title`, () => {
    const { container } = render(
      <MockProvider>
        <Icon />
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.querySelector(`title`)).toBeNull();
    expect(svg.getAttribute(`aria-hidden`)).toBe(`true`);
  });

  it(`merges a custom class name`, () => {
    const { container } = render(
      <MockProvider>
        <Icon className="extra" />
      </MockProvider>
    );
    const svg = container.querySelector(`svg`) as SVGSVGElement;
    expect(svg.classList.contains(`extra`)).toBe(true);
  });
});
