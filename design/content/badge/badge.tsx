import React from 'react';
import classNames from 'classnames';
import styles from './badge.module.scss';

export type BadgeProps = {
  /**
   * the label of the badge. rendered in uppercase.
   */
  children?: React.ReactNode;

  /**
   * the color tone of the badge.
   * `brand` is an alias of `info`.
   */
  tone?: 'critical' | 'warning' | 'info' | 'brand' | 'success' | 'neutral';

  /**
   * the visual variant of the badge.
   * `label` renders text only, `dot` adds a status dot before the label
   * and `count` renders a compact solid number badge.
   */
  variant?: 'label' | 'dot' | 'count';

  /**
   * the number to show in the `count` variant.
   */
  count?: number;

  /**
   * the maximum count to display before showing `max+`.
   */
  max?: number;

  /**
   * hide the badge in the `count` variant when the count is zero.
   */
  hideZero?: boolean;

  /**
   * class name for the badge.
   */
  className?: string;

  /**
   * inline style for the badge.
   */
  style?: React.CSSProperties;
};

const toneClasses = {
  critical: styles.critical,
  warning: styles.warning,
  info: styles.info,
  brand: styles.info,
  success: styles.success,
  neutral: styles.neutral,
};

/**
 * a small pill badge for statuses, severities and counters.
 */
export function Badge({
  children,
  tone = `neutral`,
  variant = `label`,
  count = 0,
  max = 99,
  hideZero,
  className,
  style,
}: BadgeProps) {
  if (variant === `count` && hideZero && count <= 0) {
    return null;
  }

  const toneClass = toneClasses[tone];
  const countLabel = count > max ? `${max}+` : `${count}`;

  return (
    <span
      className={classNames(
        styles.badge,
        toneClass,
        variant === `count` && styles.count,
        className
      )}
      style={style}
    >
      {variant === `dot` && <span className={styles.dot} />}
      {variant === `count` ? (
        <span className={styles.countValue}>{countLabel}</span>
      ) : (
        <span className={styles.label}>{children}</span>
      )}
    </span>
  );
}
