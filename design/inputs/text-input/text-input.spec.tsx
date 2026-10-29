import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { TextInput } from './text-input.js';
import styles from './text-input.module.scss';

describe('TextInput', () => {
  it('renders the label', () => {
    const { container } = render(
      <MockProvider>
        <TextInput label="Server name" />
      </MockProvider>
    );
    const label = container.querySelector(`.${styles.label}`);
    expect(label?.textContent).toContain(`Server name`);
  });

  it('renders the hint when there is no error', () => {
    const { container } = render(
      <MockProvider>
        <TextInput hint="Helpful text" />
      </MockProvider>
    );
    const hint = container.querySelector(`.${styles.hintText}`);
    expect(hint?.textContent).toBe(`Helpful text`);
  });

  it('renders the error instead of the hint', () => {
    const { container } = render(
      <MockProvider>
        <TextInput hint="Helpful text" error="Something is wrong" />
      </MockProvider>
    );
    const error = container.querySelector(`.${styles.errorText}`);
    expect(error?.textContent).toBe(`Something is wrong`);
    expect(container.querySelector(`.${styles.hintText}`)).toBeNull();
    expect(container.querySelector(`.${styles.invalid}`)).not.toBeNull();
  });

  it('renders prefix and suffix', () => {
    const { container } = render(
      <MockProvider>
        <TextInput prefix="#" suffix="px" />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.prefix}`)?.textContent).toBe(`#`);
    expect(container.querySelector(`.${styles.suffix}`)?.textContent).toBe(`px`);
  });

  it('applies the size class', () => {
    const { container } = render(
      <MockProvider>
        <TextInput size="large" />
      </MockProvider>
    );
    expect(container.querySelector(`.${styles.large}`)).not.toBeNull();
  });

  it('calls onChange with the new value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <MockProvider>
        <TextInput onChange={(value) => onChange(value)} />
      </MockProvider>
    );
    const input = container.querySelector(`.${styles.input}`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: `hello` } });
    expect(onChange).toHaveBeenCalledWith(`hello`);
  });

  it('disables the input', () => {
    const { container } = render(
      <MockProvider>
        <TextInput disabled />
      </MockProvider>
    );
    const input = container.querySelector(`.${styles.input}`) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
