import { render, fireEvent } from '@testing-library/react';
import { GuildpilotTheme } from './guildpilot-theme.js';
import { useThemeController } from './theme-controller.js';

function ModeReader() {
  const { themeMode, toggleTheme } = useThemeController();

  return (
    <button type="button" className="mode" onClick={() => toggleTheme()}>
      {themeMode}
    </button>
  );
}

it('renders with the correct children', () => {
  const { getByText } = render(<GuildpilotTheme>Hello world!</GuildpilotTheme>);
  expect(getByText('Hello world!')).toBeTruthy();
});

it('defaults to the dark theme mode', () => {
  const { container } = render(
    <GuildpilotTheme>
      <ModeReader />
    </GuildpilotTheme>
  );
  expect(container.querySelector('.mode')?.textContent).toBe('dark');
});

it('starts in light mode when initialTheme is light', () => {
  const { container } = render(
    <GuildpilotTheme initialTheme="light">
      <ModeReader />
    </GuildpilotTheme>
  );
  expect(container.querySelector('.mode')?.textContent).toBe('light');
});

it('toggles the theme mode through the controller', () => {
  const { container } = render(
    <GuildpilotTheme>
      <ModeReader />
    </GuildpilotTheme>
  );
  fireEvent.click(container.querySelector('.mode') as HTMLButtonElement);
  expect(container.querySelector('.mode')?.textContent).toBe('light');
});
