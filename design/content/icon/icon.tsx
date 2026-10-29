import React from 'react';
import classNames from 'classnames';
import styles from './icon.module.scss';

export type IconProps = {
  /**
   * path(s) or other SVG elements drawn inside the icon.
   */
  children?: React.ReactNode;

  /**
   * width and height of the icon. numbers are treated as pixels.
   */
  size?: number | string;

  /**
   * color of the icon. defaults to the inherited text color.
   */
  color?: string;

  /**
   * accessible title. when set the icon is exposed to assistive technology,
   * otherwise it is hidden from it.
   */
  title?: string;

  /**
   * the SVG view box.
   */
  viewBox?: string;

  /**
   * render the icon as an outline (stroke) icon instead of a filled one.
   */
  outline?: boolean;

  /**
   * stroke width, used when `outline` is set.
   */
  strokeWidth?: number;

  /**
   * class name for the svg element.
   */
  className?: string;

  /**
   * inline style for the svg element.
   */
  style?: React.CSSProperties;
};

const DEFAULT_PATH = `M12 2 L22 20 H2 Z`;

/**
 * base SVG icon: sizes itself, inherits color via currentColor
 * and supports an accessible title. used by all icon sets.
 */
export function Icon({
  children,
  size = 24,
  color = `currentColor`,
  title,
  viewBox = `0 0 24 24`,
  outline,
  strokeWidth = 2,
  className,
  style,
}: IconProps) {
  const hasTitle = Boolean(title);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={classNames(styles.icon, className)}
      style={style}
      width={size}
      height={size}
      viewBox={viewBox}
      fill={outline ? `none` : color}
      stroke={outline ? color : `none`}
      strokeWidth={outline ? strokeWidth : undefined}
      strokeLinecap={outline ? `round` : undefined}
      strokeLinejoin={outline ? `round` : undefined}
      role={hasTitle ? `img` : undefined}
      aria-hidden={hasTitle ? undefined : true}
      focusable="false"
    >
      {hasTitle ? <title>{title}</title> : null}
      {children ?? <path d={DEFAULT_PATH} />}
    </svg>
  );
}
