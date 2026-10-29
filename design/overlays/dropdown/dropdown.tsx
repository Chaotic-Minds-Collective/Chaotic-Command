import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import classNames from 'classnames';
import type { DropdownItemType } from './dropdown-item-type.js';
import { defaultDropdownItems } from './dropdown.mock.js';
import styles from './dropdown.module.scss';

export type DropdownProps = {
  /**
   * content of the trigger button.
   */
  trigger?: React.ReactNode;

  /**
   * menu items to render.
   */
  items?: DropdownItemType[];

  /**
   * called with the item id when an item is selected.
   */
  onSelect?: (id: string) => void;

  /**
   * horizontal alignment of the menu relative to the trigger.
   */
  align?: 'start' | 'end';

  /**
   * accessible label of the menu.
   */
  label?: string;

  /**
   * disable the trigger.
   */
  disabled?: boolean;

  /**
   * class name for the root element.
   */
  className?: string;

  /**
   * class name for the trigger button.
   */
  triggerClassName?: string;

  /**
   * class name for the menu.
   */
  menuClassName?: string;

  /**
   * inline style for the root element.
   */
  style?: React.CSSProperties;
};

/**
 * a dropdown menu with a trigger, icon items, danger items, dividers
 * and full keyboard navigation.
 */
export function Dropdown({
  trigger = `Actions`,
  items = defaultDropdownItems,
  onSelect,
  align = `start`,
  label = `Menu`,
  disabled,
  className,
  triggerClassName,
  menuClassName,
  style,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const enabledIndexes = items.reduce<number[]>((acc, item, index) => {
    return item.disabled ? acc : [...acc, index];
  }, []);

  const openAt = useCallback(
    (position: 'first' | 'last') => {
      if (enabledIndexes.length === 0) {
        setOpen(true);
        setActiveIndex(-1);
        return;
      }
      setOpen(true);
      setActiveIndex(position === `first` ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]);
    },
    [enabledIndexes]
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    globalThis.document.addEventListener(`mousedown`, handlePointer);
    return () => globalThis.document.removeEventListener(`mousedown`, handlePointer);
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  const move = (step: number) => {
    if (enabledIndexes.length === 0) return;
    const current = enabledIndexes.indexOf(activeIndex);
    const next = (current + step + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[next]);
  };

  const handleTriggerKeyDown = (key: string): boolean => {
    if (key === `ArrowDown`) {
      openAt(`first`);
      return true;
    }
    if (key === `ArrowUp`) {
      openAt(`last`);
      return true;
    }
    return false;
  };

  const handleMenuKeyDown = (key: string): boolean => {
    switch (key) {
      case `ArrowDown`:
        move(1);
        return true;
      case `ArrowUp`:
        move(-1);
        return true;
      case `Home`:
        if (enabledIndexes.length) setActiveIndex(enabledIndexes[0]);
        return true;
      case `End`:
        if (enabledIndexes.length) setActiveIndex(enabledIndexes[enabledIndexes.length - 1]);
        return true;
      case `Escape`:
        close(true);
        return true;
      case `Tab`:
        close(false);
        return false;
      default:
        return false;
    }
  };

  return (
    <div ref={rootRef} className={classNames(styles.dropdown, className)} style={style}>
      <button
        ref={triggerRef}
        type="button"
        className={classNames(styles.trigger, open && styles.triggerOpen, triggerClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openAt(`first`))}
        onKeyDown={(event) => {
          if (handleTriggerKeyDown(event.key)) event.preventDefault();
        }}
      >
        <span className={styles.triggerContent}>{trigger}</span>
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={classNames(styles.menu, align === `end` ? styles.alignEnd : styles.alignStart, menuClassName)}
          onKeyDown={(event) => {
            if (handleMenuKeyDown(event.key)) event.preventDefault();
          }}
        >
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {item.divider && index > 0 ? <div role="separator" className={styles.divider} /> : null}
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={index === activeIndex ? 0 : -1}
                disabled={item.disabled}
                className={classNames(styles.item, item.danger && styles.danger, index === activeIndex && styles.active)}
                onMouseEnter={() => {
                  if (!item.disabled) setActiveIndex(index);
                }}
                onClick={() => {
                  onSelect?.(item.id);
                  close(true);
                }}
              >
                {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
                <span className={styles.label}>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
