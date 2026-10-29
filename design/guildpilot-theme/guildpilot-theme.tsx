import React, { type ReactNode, useCallback, useState } from 'react';
import classNames from 'classnames';
import { mergeTokenSchema, type DeepPartial } from '@bitdesign/sparks.sparks-theme';
import { GuildpilotThemeProvider } from './guildpilot-theme-provider.js';
import { type GuildpilotThemeSchema } from './guildpilot-theme-tokens.js';
import { ThemeContext, type ThemeContextValue, type ThemeMode } from './theme-controller.js';
import { themeOptions } from './theme-options.js';
import styles from './guildpilot-theme.module.scss';

export type GuildpilotThemeProps = {
  /**
   * a root ReactNode for the component tree
   * applied with the theme.
   */
  children?: ReactNode;

  /**
   * inject a class name to override to the theme.
   */
  className?: string;

  /**
   * override tokens in the schema
   */
  overrides?: DeepPartial<GuildpilotThemeSchema>;

  /**
   * preset of the theme. defaults to the dark theme.
   */
  initialTheme?: ThemeMode;

  /**
   * style tags to include.
   */
  style?: React.CSSProperties;
};

/**
 * a dark, Discord-inspired theme for GuildPilot with an optional light variant.
 * it provides tokens, fonts and general styling for all components.
 */
export function GuildpilotTheme({
  children,
  initialTheme = 'dark',
  overrides,
  className,
  style,
}: GuildpilotThemeProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initialTheme);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  }, []);

  const themeContextValue: ThemeContextValue = {
    themeMode,
    toggleTheme,
    setThemeMode,
  };

  const themeOverrides =
    themeMode === 'light' ? mergeTokenSchema(themeOptions.light, overrides) : overrides;

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <GuildpilotThemeProvider.ThemeProvider
        className={classNames(styles.guildpilotTheme, className)}
        overrides={themeOverrides}
        style={style}
      >
        {children}
      </GuildpilotThemeProvider.ThemeProvider>
    </ThemeContext.Provider>
  );
}
