import React, { type ReactNode } from 'react';
import classNames from 'classnames';
import { ExternalIcon } from './external-icon.js';
import styles from './link.module.scss';

export type LinkProps = {
  /**
   * the destination of the link.
   */
  href?: string;

  /**
   * the content of the link.
   */
  children?: ReactNode;

  /**
   * visual variant of the link.
   */
  variant?: 'default' | 'muted' | 'nav';

  /**
   * marks the link as the current/active one.
   */
  active?: boolean;

  /**
   * force external handling (new tab, safe rel and icon).
   * detected automatically for absolute urls.
   */
  external?: boolean;

  /**
   * hide the external indicator icon.
   */
  hideExternalIcon?: boolean;

  /**
   * leading element, such as an icon or emoji.
   */
  icon?: ReactNode;

  /**
   * trailing element, such as a badge or counter.
   */
  badge?: ReactNode;

  /**
   * called when the link is clicked.
   */
  onClick?: () => void;

  /**
   * called with the href on a plain left click of an internal link.
   * the browser navigation is prevented so any router can handle it,
   * for example `onNavigate={(to) => navigate(to)}`.
   */
  onNavigate?: (href: string) => void;

  /**
   * class name for the link.
   */
  className?: string;

  /**
   * inline style for the link.
   */
  style?: React.CSSProperties;
};

const EXTERNAL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const PROTOCOL_PATTERN = /^(?:mailto|tel):/i;

/**
 * a router-agnostic link with default, muted and nav variants,
 * an active state and automatic external link handling.
 */
export function Link({
  href = `/`,
  children,
  variant = `default`,
  active,
  external,
  hideExternalIcon,
  icon,
  badge,
  onClick,
  onNavigate,
  className,
  style,
}: LinkProps) {
  const isExternal = external ?? EXTERNAL_PATTERN.test(href);
  const isSpecial = PROTOCOL_PATTERN.test(href);

  const variantClass = {
    default: styles.default,
    muted: styles.muted,
    nav: styles.nav,
  }[variant];

  return (
    <a
      href={href}
      className={classNames(styles.link, variantClass, active && styles.active, className)}
      style={style}
      target={isExternal ? `_blank` : undefined}
      rel={isExternal ? `noopener noreferrer` : undefined}
      aria-current={active ? `page` : undefined}
      onClick={(event) => {
        onClick?.();
        const plain =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !event.defaultPrevented;
        if (onNavigate && plain && !isExternal && !isSpecial) {
          event.preventDefault();
          onNavigate(href);
        }
      }}
    >
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.label}>{children}</span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      {isExternal && !hideExternalIcon ? <ExternalIcon className={styles.externalIcon} /> : null}
    </a>
  );
}
