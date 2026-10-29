import React from 'react';
import classNames from 'classnames';
import styles from './heading.module.scss';

export type HeadingProps = {
  /**
   * the semantic heading level, renders h1 to h6.
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * the visual size, from 1 (largest) to 6 (smallest).
   * defaults to the size of the semantic level.
   */
  size?: 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * the font weight of the heading.
   */
  weight?: 'regular' | 'medium' | 'semi-bold' | 'bold' | 'extra-bold';

  /**
   * render the heading using the muted text color.
   */
  muted?: boolean;

  /**
   * the text alignment of the heading.
   */
  align?: 'start' | 'center' | 'end';

  /**
   * truncate overflowing text to a single line with an ellipsis.
   */
  truncate?: boolean;

  /**
   * the heading content.
   */
  children?: React.ReactNode;

  /**
   * a class name to apply to the heading.
   */
  className?: string;

  /**
   * inline styles for the heading.
   */
  style?: React.CSSProperties;
};

const sizeClasses = {
  1: styles.sizeOne,
  2: styles.sizeTwo,
  3: styles.sizeThree,
  4: styles.sizeFour,
  5: styles.sizeFive,
  6: styles.sizeSix,
};

const weightClasses = {
  regular: styles.weightRegular,
  medium: styles.weightMedium,
  'semi-bold': styles.weightSemiBold,
  bold: styles.weightBold,
  'extra-bold': styles.weightExtraBold,
};

const alignClasses = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
};

/**
 * a heading element (h1-h6) with fluid responsive sizes,
 * configurable font weight and an optional muted color.
 */
export function Heading({
  level = 2,
  size,
  weight = `bold`,
  muted,
  align,
  truncate,
  children,
  className,
  style,
}: HeadingProps) {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  const visualSize = size ?? level;

  return (
    <Tag
      className={classNames(
        styles.heading,
        sizeClasses[visualSize],
        weightClasses[weight],
        align && alignClasses[align],
        muted && styles.muted,
        truncate && styles.truncate,
        className
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}
