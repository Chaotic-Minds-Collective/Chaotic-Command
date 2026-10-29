import React from 'react';
import classNames from 'classnames';
import styles from './card.module.scss';

export type CardPadding = 'none' | 'small' | 'medium' | 'large';

export type CardProps = {
  /**
   * content of the card body.
   */
  children?: React.ReactNode;

  /**
   * optional title rendered in the card header.
   */
  title?: React.ReactNode;

  /**
   * optional slot rendered at the end of the card header, for example buttons.
   */
  actions?: React.ReactNode;

  /**
   * makes the card behave as a selectable option (focusable, clickable, with a keyboard toggle).
   */
  selectable?: boolean;

  /**
   * marks a selectable card as selected.
   */
  selected?: boolean;

  /**
   * lifts the card on hover and shows a pointer cursor.
   */
  interactive?: boolean;

  /**
   * size of the card padding.
   */
  padding?: CardPadding;

  /**
   * called when a selectable or interactive card is clicked or activated by keyboard.
   */
  onSelect?: () => void;

  /**
   * class name for the card.
   */
  className?: string;

  /**
   * inline style for the card.
   */
  style?: React.CSSProperties;
};

const paddingClasses = {
  none: styles.paddingNone,
  small: styles.paddingSmall,
  medium: styles.paddingMedium,
  large: styles.paddingLarge,
};

/**
 * a panel card with optional title and actions, selectable state and interactive hover lift.
 */
export function Card({
  children,
  title,
  actions,
  selectable = false,
  selected = false,
  interactive = false,
  padding = `medium`,
  onSelect,
  className,
  style,
}: CardProps) {
  const isClickable = selectable || interactive || Boolean(onSelect);
  const hasHeader = Boolean(title) || Boolean(actions);

  const handleKeyDown = (key: string) => {
    if (key === `Enter` || key === ` `) {
      onSelect?.();
    }
  };

  return (
    <div
      className={classNames(
        styles.card,
        paddingClasses[padding],
        isClickable && styles.clickable,
        (interactive || selectable) && styles.interactive,
        selectable && selected && styles.selected,
        className
      )}
      style={style}
      role={selectable ? `option` : undefined}
      aria-selected={selectable ? selected : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onSelect?.() : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.target === event.currentTarget) {
                if (event.key === ` `) event.preventDefault();
                handleKeyDown(event.key);
              }
            }
          : undefined
      }
    >
      {hasHeader && (
        <div className={styles.header}>
          {title ? <h3 className={styles.title}>{title}</h3> : <span className={styles.spacer} />}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      )}
      {children !== undefined && children !== null && <div className={styles.body}>{children}</div>}
    </div>
  );
}
