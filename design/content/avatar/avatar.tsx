import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import type { AvatarShape } from './avatar-shape-type.js';
import type { AvatarSize } from './avatar-size-type.js';
import type { AvatarStatus } from './avatar-status-type.js';
import styles from './avatar.module.scss';

export type AvatarProps = {
  /**
   * image url. when missing or failing to load, initials are shown.
   */
  src?: string;

  /**
   * name used for the initials fallback and the accessible label.
   */
  name?: string;

  /**
   * alternative text of the image. defaults to the name.
   */
  alt?: string;

  /**
   * size of the avatar.
   */
  size?: AvatarSize;

  /**
   * `round` for users, `square` (rounded corners) for server icons.
   */
  shape?: AvatarShape;

  /**
   * optional presence status dot.
   */
  status?: AvatarStatus;

  /**
   * class name for the root element.
   */
  className?: string;

  /**
   * inline style for the root element.
   */
  style?: React.CSSProperties;
};

const PALETTE_SIZE = 5;

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return `?`;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase();
}

function getPaletteIndex(name: string) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return hash % PALETTE_SIZE;
}

/**
 * an avatar showing an image with an initials fallback,
 * in round or square (server icon) shape, with an optional status dot.
 */
export function Avatar({
  src,
  name = `Guild Pilot`,
  alt,
  size = `md`,
  shape = `round`,
  status,
  className,
  style,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;
  const palette = getPaletteIndex(name);

  return (
    <span
      className={classNames(styles.avatar, styles[size], styles[shape], className)}
      style={style}
      role="img"
      aria-label={alt || name}
    >
      {showImage ? (
        <img className={styles.image} src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={classNames(styles.initials, styles[`palette${palette}`])}>{getInitials(name)}</span>
      )}
      {status ? <span className={classNames(styles.status, styles[status])} title={status} /> : null}
    </span>
  );
}
