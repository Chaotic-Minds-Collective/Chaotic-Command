import { createTheme } from '@bitdesign/sparks.sparks-theme';
import { GuildpilotThemeSchema, guildpilotTokens } from './guildpilot-theme-tokens.js';

/**
 * creating and declaring the guildpilot theme.
 * define the theme schema as a type variable for proper type completions.
 */
export const GuildpilotThemeProvider = createTheme<GuildpilotThemeSchema>({
  tokens: guildpilotTokens,
});

/**
 * a react hook for contextual access to design token
 * from components.
 */
export const { useTheme } = GuildpilotThemeProvider;
