/**
 * GuildPilot tokens theme.
 * Dark, Discord-inspired default. Include all tokens in this object.
 */
export function guildpilotTokens() {
  const tokens = {
    /**
     * Page background (used by the theme root and `body`).
     */
    backgroundColor: '#0f1117',

    /**
     * Color Palette
     */
    colors: {
      primary: {
        default: '#5865F2', // Brand blurple
        hover: '#6d79f5', // Blurple hover
        active: '#4752d6', // Blurple pressed
      },
      secondary: {
        default: '#3BD6A0', // Accent mint
        hover: '#55e0b0', // Mint hover
        active: '#2fb986', // Mint pressed
      },
      surface: {
        background: '#0f1117', // App background
        primary: '#171a23', // Panel
        secondary: '#1e2230', // Panel 2 (raised / inputs)
        panel: '#171a23', // Panel
        panel2: '#1e2230', // Panel 2
        border: '#2a2f40', // Surface border
      },
      text: {
        primary: '#e6e8ee', // Main text
        default: '#e6e8ee', // Main text
        secondary: '#8b91a3', // Muted text
        muted: '#8b91a3', // Muted text
        inverse: '#0b1a13', // Text on mint / light fills
        onBrand: '#ffffff', // Text on blurple / danger fills
      },
      status: {
        positive: { default: '#3BD6A0', subtle: 'rgba(59, 214, 160, 0.14)' },
        negative: { default: '#ED4245', subtle: 'rgba(237, 66, 69, 0.15)' },
        warning: { default: '#F5A524', subtle: 'rgba(245, 165, 36, 0.15)' },
        info: { default: '#9aa3ff', subtle: 'rgba(88, 101, 242, 0.18)' },
        success: { default: '#3BD6A0', subtle: 'rgba(59, 214, 160, 0.14)' },
        danger: { default: '#ED4245', subtle: 'rgba(237, 66, 69, 0.15)' },
      },
      brand: {
        subtle: 'rgba(88, 101, 242, 0.16)', // Active nav / selected tint
        strong: 'rgba(88, 101, 242, 0.2)', // Staff message tint
      },
      overlay: 'rgba(5, 6, 10, 0.7)', // Modal overlay
    },

    borders: {
      default: {
        color: '#2a2f40',
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

    /**
     * Typography System
     */
    typography: {
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      monoFontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
      sizes: {
        display: { large: '48px', medium: '40px', small: '32px' },
        heading: {
          h1: '30px',
          h2: '24px',
          h3: '20px',
          h4: '18px',
          h5: '16px',
          h6: '14px',
        },
        body: { large: '18px', medium: '16px', default: '15px', small: '14px' },
        caption: { default: '12px', medium: '13px' },
      },
      lineHeight: {
        base: '1.5',
        heading: '1.2',
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semiBold: '600',
        bold: '700',
        extraBold: '800',
      },
      letterSpacing: {
        tight: '-0.02em',
        normal: '0',
        wide: '0.03em',
      },
    },

    /**
     * Spacing & Layout
     */
    spacing: {
      default: '8px',
      xs: '4px',
      small: '8px',
      medium: '12px',
      large: '16px',
      xl: '24px',
      x2: '32px',
      x4: '48px',
    },

    layout: {
      maxPageWidth: '1280px',
      gutter: '16px',
      sidebarWidth: '248px',
    },

    /**
     * Visual Effects
     */
    effects: {
      shadows: {
        xs: '0px 1px 2px rgba(0, 0, 0, 0.3)',
        small: '0px 2px 6px rgba(0, 0, 0, 0.35)',
        medium: '0px 6px 16px rgba(0, 0, 0, 0.4)',
        large: '0px 12px 28px rgba(0, 0, 0, 0.45)',
        xLarge: '0px 20px 44px rgba(0, 0, 0, 0.55)',
        inset: 'inset 0px 1px 2px rgba(0, 0, 0, 0.35)',
        raised: '0px 6px 18px rgba(0, 0, 0, 0.4), 0px 1px 0px rgba(255, 255, 255, 0.04) inset',
        focus: '0 0 0 2px #0f1117, 0 0 0 4px #5865F2',
        glow: '0 0 0 1px #5865F2, 0px 8px 24px rgba(88, 101, 242, 0.35)',
      },
      opacity: { disabled: '0.5', hover: '0.85', faint: '0.2', semiOpaque: '0.7' },
      gradients: {
        primary: 'linear-gradient(135deg, #5865F2, #3BD6A0)',
        secondary: 'linear-gradient(90deg, #5865F2, #3BD6A0)',
        radial: 'radial-gradient(circle at 20% 0%, rgba(88, 101, 242, 0.28), rgba(15, 17, 23, 0) 60%)',
      },
      blur: {
        small: 'blur(4px)',
        medium: 'blur(8px)',
        large: 'blur(16px)',
      },
    },

    /**
     * Interaction & Motion
     */
    interactions: {
      cursor: { pointer: 'pointer', disabled: 'not-allowed', text: 'text', grab: 'grab', grabbing: 'grabbing' },
      zIndex: { base: '1', modal: '100', tooltip: '200', overlay: '300', sticky: '50' },
      gradients: {
        primary: 'linear-gradient(135deg, #5865F2, #3BD6A0)',
        secondary: 'linear-gradient(135deg, #1e2230, #171a23)',
        subtle: 'linear-gradient(to bottom, rgba(30, 34, 48, 0.8), rgba(23, 26, 35, 0.6))',
        codeBlock: 'linear-gradient(to right, #171a23, #1e2230)',
      },
      transitions: {
        duration: { fast: '0.15s', medium: '0.3s', slow: '0.4s', verySlow: '1s' },
        easing: {
          easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
          easeOut: 'ease-out',
          easeIn: 'ease-in',
          spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        },
        property: {
          all: 'all',
          transform: 'transform',
          opacity: 'opacity',
          color: 'color',
          shadow: 'box-shadow',
        },
      },
      hoverEffect: {
        scale: 'scale(1.03)',
        translateY: 'translateY(-2px)',
        shadow: '0px 8px 20px rgba(0, 0, 0, 0.45)',
      },
    },
  };

  return tokens;
}

/**
 * Use tokens from this schema as css variables in your components.
 * For example, use `colors.surface.panel` as css variable `--colors-surface-panel`
 */
export type GuildpilotThemeSchema = ReturnType<typeof guildpilotTokens>;
