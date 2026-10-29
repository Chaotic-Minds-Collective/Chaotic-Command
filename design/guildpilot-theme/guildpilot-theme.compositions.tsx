import { TokenViewer } from '@bitdesign/sparks.sparks-theme';
import { useTheme } from './guildpilot-theme-provider.js';
import { GuildpilotTheme } from './guildpilot-theme.js';
import styles from './guildpilot-theme-brand-book.module.scss';

function ViewTokens() {
  const theme = useTheme();

  return <TokenViewer theme={theme} />;
}

const surfaces = [
  { name: 'Background', variable: '--colors-surface-background' },
  { name: 'Panel', variable: '--colors-surface-panel' },
  { name: 'Panel 2', variable: '--colors-surface-panel2' },
  { name: 'Border', variable: '--colors-surface-border' },
];

const brandColors = [
  { name: 'Blurple', variable: '--colors-primary-default' },
  { name: 'Mint', variable: '--colors-secondary-default' },
  { name: 'Danger', variable: '--colors-status-danger-default' },
  { name: 'Warning', variable: '--colors-status-warning-default' },
  { name: 'Success', variable: '--colors-status-success-default' },
  { name: 'Info', variable: '--colors-status-info-default' },
];

const radii = [
  { name: '8', variable: '--borders-radius-small' },
  { name: '10', variable: '--borders-radius-medium' },
  { name: '14', variable: '--borders-radius-large' },
  { name: '99', variable: '--borders-radius-pill' },
];

const shadows = [
  { name: 'Small', variable: '--effects-shadows-small' },
  { name: 'Medium', variable: '--effects-shadows-medium' },
  { name: 'Large', variable: '--effects-shadows-large' },
  { name: 'Glow', variable: '--effects-shadows-glow' },
];

const typeScale = [
  { name: 'Display', variable: '--typography-sizes-display-small', weight: '--typography-font-weight-extra-bold' },
  { name: 'Heading 1', variable: '--typography-sizes-heading-h1', weight: '--typography-font-weight-bold' },
  { name: 'Heading 2', variable: '--typography-sizes-heading-h2', weight: '--typography-font-weight-bold' },
  { name: 'Heading 3', variable: '--typography-sizes-heading-h3', weight: '--typography-font-weight-semi-bold' },
  { name: 'Body', variable: '--typography-sizes-body-default', weight: '--typography-font-weight-regular' },
  { name: 'Caption', variable: '--typography-sizes-caption-default', weight: '--typography-font-weight-medium' },
];

function BrandBook() {
  return (
    <div className={styles.brandBook}>
      <header className={styles.hero}>
        <div className={styles.logo}>GP</div>
        <div>
          <h1 className={styles.title}>GuildPilot Brand Book</h1>
          <p className={styles.subtitle}>
            A dark, Discord-inspired design language for community moderation, tickets and server health.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Surfaces</h2>
        <div className={styles.grid}>
          {surfaces.map((item) => (
            <div key={item.name} className={styles.swatchCard}>
              <div className={styles.swatch} style={{ background: `var(${item.variable})` }} />
              <strong>{item.name}</strong>
              <span className={styles.muted}>{item.variable}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Brand and status</h2>
        <div className={styles.grid}>
          {brandColors.map((item) => (
            <div key={item.name} className={styles.swatchCard}>
              <div className={styles.swatch} style={{ background: `var(${item.variable})` }} />
              <strong>{item.name}</strong>
              <span className={styles.muted}>{item.variable}</span>
            </div>
          ))}
        </div>
        <div className={styles.gradientBar} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Typography (Inter)</h2>
        <div className={styles.card}>
          {typeScale.map((item) => (
            <div key={item.name} className={styles.typeRow}>
              <span className={styles.muted}>{item.name}</span>
              <span style={{ fontSize: `var(${item.variable})`, fontWeight: `var(${item.weight})` }}>
                Pilot your guild
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Radii</h2>
        <div className={styles.grid}>
          {radii.map((item) => (
            <div key={item.name} className={styles.radiusCard}>
              <div className={styles.radiusBox} style={{ borderRadius: `var(${item.variable})` }} />
              <span className={styles.muted}>{item.name}px</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Shadows and focus</h2>
        <div className={styles.grid}>
          {shadows.map((item) => (
            <div key={item.name} className={styles.shadowCard} style={{ boxShadow: `var(${item.variable})` }}>
              {item.name}
            </div>
          ))}
          <button type="button" className={styles.focusDemo}>
            Focus ring
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>In context</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.grow}>
              <strong>Raid detected in #general</strong>
              <div className={styles.muted}>12 new accounts joined in 30 seconds</div>
            </div>
            <span className={styles.pillDanger}>Critical</span>
            <button type="button" className={styles.btn}>
              Lock channel
            </button>
          </div>
          <div className={styles.row}>
            <div className={styles.grow}>
              <strong>Ticket #482 awaiting reply</strong>
              <div className={styles.muted}>Opened 2 hours ago</div>
            </div>
            <span className={styles.pillWarn}>Pending</span>
            <button type="button" className={styles.btnMint}>
              Reply
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export const DarkTheme = () => {
  return (
    <GuildpilotTheme>
      <ViewTokens />
    </GuildpilotTheme>
  );
};

export const LightTheme = () => {
  return (
    <GuildpilotTheme initialTheme="light">
      <ViewTokens />
    </GuildpilotTheme>
  );
};

export const BrandBookDark = () => {
  return (
    <GuildpilotTheme>
      <BrandBook />
    </GuildpilotTheme>
  );
};

export const BrandBookLight = () => {
  return (
    <GuildpilotTheme initialTheme="light">
      <BrandBook />
    </GuildpilotTheme>
  );
};
