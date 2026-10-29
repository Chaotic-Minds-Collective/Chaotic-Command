import React from 'react';
import classNames from 'classnames';
import styles from './spinner.module.scss';

export type SpinnerProps = {
  /**
   * the kind of loader to render.
   * `spinner` renders a rotating ring, `line` renders skeleton text lines
   * and `block` renders a skeleton rectangle.
   */
  variant?: 'spinner' | 'line' | 'block';

  /**
   * size of the rotating ring.
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * accessible label announced for the loader. For the `spinner` variant it is
   * also displayed next to the ring when `showLabel` is set.
   */
  label?: string;

  /**
   * display the label next to the spinner ring.
   */
  showLabel?: boolean;

  /**
   * number of skeleton lines to render in the `line` variant.
   */
  lines?: number;

  /**
   * width of the skeleton, for example `240px` or `100%`.
   */
  width?: string;

  /**
   * height of the `block` skeleton, for example `120px`.
   */
  height?: string;

  /**
   * render a circular block, useful as an avatar placeholder.
   */
  circle?: boolean;

  /**
   * class name for the root element.
   */
  className?: string;

  /**
   * inline style for the root element.
   */
  style?: React.CSSProperties;
};

const LINE_WIDTHS = ['100%', '92%', '78%', '86%', '64%'];

/**
 * spinner and skeleton line/block loaders for GuildPilot.
 */
export function Spinner({
  variant = `spinner`,
  size = `medium`,
  label = `Loading`,
  showLabel,
  lines = 3,
  width,
  height,
  circle,
  className,
  style,
}: SpinnerProps) {
  if (variant === `line`) {
    const count = Math.max(1, lines);
    const items = Array.from({ length: count }, (_, index) => index);

    return (
      <div
        className={classNames(styles.lines, className)}
        style={{ width, ...style }}
        role="status"
        aria-label={label}
        aria-busy="true"
      >
        {items.map((index) => (
          <span
            key={index}
            className={classNames(styles.skeleton, styles.line)}
            style={{ width: index === count - 1 && count > 1 ? `60%` : LINE_WIDTHS[index % LINE_WIDTHS.length] }}
          />
        ))}
      </div>
    );
  }

  if (variant === `block`) {
    return (
      <div
        className={classNames(styles.skeleton, styles.block, circle && styles.circle, className)}
        style={{ width, height: circle && !height ? width : height, ...style }}
        role="status"
        aria-label={label}
        aria-busy="true"
      />
    );
  }

  return (
    <div className={classNames(styles.spinner, className)} style={style} role="status" aria-label={label}>
      <span className={classNames(styles.ring, styles[size])} />
      {showLabel && <span className={styles.label}>{label}</span>}
    </div>
  );
}
