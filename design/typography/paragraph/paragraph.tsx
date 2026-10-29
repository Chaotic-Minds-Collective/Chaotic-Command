import React from 'react';
import classNames from 'classnames';
import styles from './paragraph.module.scss';

export type ParagraphProps = {
  /**
   * the paragraph content.
   */
  children?: React.ReactNode;

  /**
   * text size of the paragraph.
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * color tone of the paragraph.
   */
  tone?: 'default' | 'muted' | 'accent' | 'danger';

  /**
   * class name for the paragraph element.
   */
  className?: string;

  /**
   * inline style for the paragraph element.
   */
  style?: React.CSSProperties;
};

/**
 * a paragraph of body text with three sizes and four tones,
 * built on the GuildPilot typography tokens.
 */
export function Paragraph({
  children = `Pilot your guild with confidence. GuildPilot keeps moderation, tickets and server health in one calm place.`,
  size = `md`,
  tone = `default`,
  className,
  style,
}: ParagraphProps) {
  return (
    <p className={classNames(styles.paragraph, styles[size], styles[tone], className)} style={style}>
      {children}
    </p>
  );
}
