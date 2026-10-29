import { DeepPartial } from '@bitdesign/sparks.sparks-theme';
import { GuildpilotThemeSchema } from './guildpilot-theme-tokens.js';

/**
 * override tokens for the optional light theme.
 * overrides the default dark theme tokens.
 */
export const lightThemeSchema: DeepPartial<GuildpilotThemeSchema> = {
  backgroundColor: '#f4f5f9',
  colors: {
    primary: {
      default: '#5865F2',
      hover: '#4752d6',
      active: '#3b45b8',
    },
    secondary: {
      default: '#1fb787',
      hover: '#19a077',
      active: '#148562',
    },
    surface: {
      background: '#f4f5f9',
      primary: '#ffffff',
      secondary: '#eef0f6',
      panel: '#ffffff',
      panel2: '#eef0f6',
      border: '#dcdfea',
    },
    text: {
      primary: '#1b1e2b',
      default: '#1b1e2b',
      secondary: '#5f6578',
      muted: '#5f6578',
      inverse: '#ffffff',
      onBrand: '#ffffff',
    },
    status: {
      positive: { default: '#14876a', subtle: 'rgba(31, 183, 135, 0.14)' },
      negative: { default: '#d12f32', subtle: 'rgba(237, 66, 69, 0.12)' },
      warning: { default: '#b86e00', subtle: 'rgba(245, 165, 36, 0.18)' },
      info: { default: '#4752d6', subtle: 'rgba(88, 101, 242, 0.12)' },
      success: { default: '#14876a', subtle: 'rgba(31, 183, 135, 0.14)' },
      danger: { default: '#d12f32', subtle: 'rgba(237, 66, 69, 0.12)' },
    },
    brand: {
      subtle: 'rgba(88, 101, 242, 0.1)',
      strong: 'rgba(88, 101, 242, 0.16)',
    },
    overlay: 'rgba(20, 22, 33, 0.5)',
  },
  borders: {
    default: {
      color: '#dcdfea',
      width: '1px',
      style: 'solid',
    },
    focus: {
      color: '#5865F2',
      width: '2px',
      style: 'solid',
      offset: '2px',
    },
    radius: {
      small: '8px',
      medium: '10px',
      large: '14px',
      pill: '99px',
    },
  },
  effects: {
    shadows: {
      xs: '0px 1px 2px rgba(27, 30, 43, 0.08)',
      small: '0px 2px 6px rgba(27, 30, 43, 0.1)',
      medium: '0px 6px 16px rgba(27, 30, 43, 0.12)',
      large: '0px 12px 28px rgba(27, 30, 43, 0.14)',
      xLarge: '0px 20px 44px rgba(27, 30, 43, 0.18)',
      inset: 'inset 0px 1px 2px rgba(27, 30, 43, 0.1)',
      raised: '0px 6px 18px rgba(27, 30, 43, 0.12), 0px 1px 0px rgba(255, 255, 255, 0.8) inset',
      focus: '0 0 0 2px #f4f5f9, 0 0 0 4px #5865F2',
      glow: '0 0 0 1px #5865F2, 0px 8px 24px rgba(88, 101, 242, 0.25)',
    },
    opacity: { disabled: '0.5', hover: '0.85', faint: '0.2', semiOpaque: '0.7' },
    gradients: {
      primary: 'linear-gradient(135deg, #5865F2, #1fb787)',
      secondary: 'linear-gradient(90deg, #5865F2, #1fb787)',
      radial: 'radial-gradient(circle at 20% 0%, rgba(88, 101, 242, 0.18), rgba(244, 245, 249, 0) 60%)',
    },
    blur: {
      small: 'blur(4px)',
      medium: 'blur(8px)',
      large: 'blur(16px)',
    },
  },
};
