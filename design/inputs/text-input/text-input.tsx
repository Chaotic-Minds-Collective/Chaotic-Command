import React, { useId, type ReactNode } from 'react';
import classNames from 'classnames';
import styles from './text-input.module.scss';

export type TextInputSize = 'small' | 'medium' | 'large';

export type TextInputProps = {
  /**
   * label displayed above the input.
   */
  label?: ReactNode;

  /**
   * helper text displayed below the input.
   */
  hint?: ReactNode;

  /**
   * error message displayed below the input. Puts the input in an error state.
   */
  error?: ReactNode;

  /**
   * content rendered at the start of the field, such as an icon or text.
   */
  prefix?: ReactNode;

  /**
   * content rendered at the end of the field, such as an icon or text.
   */
  suffix?: ReactNode;

  /**
   * size of the input.
   */
  size?: TextInputSize;

  /**
   * controlled value of the input.
   */
  value?: string;

  /**
   * initial value for an uncontrolled input.
   */
  defaultValue?: string;

  /**
   * placeholder text.
   */
  placeholder?: string;

  /**
   * native input type.
   */
  type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number';

  /**
   * name of the input.
   */
  name?: string;

  /**
   * id of the input. Generated when omitted.
   */
  id?: string;

  /**
   * disables the input.
   */
  disabled?: boolean;

  /**
   * marks the input as required.
   */
  required?: boolean;

  /**
   * makes the input read only.
   */
  readOnly?: boolean;

  /**
   * called with the new value when the input changes.
   */
  onChange?: (value: string) => void;

  /**
   * called when the input receives focus.
   */
  onFocus?: () => void;

  /**
   * called when the input loses focus.
   */
  onBlur?: () => void;

  /**
   * class name for the root element.
   */
  className?: string;

  /**
   * inline style for the root element.
   */
  style?: React.CSSProperties;
};

/**
 * a dark text input with label, hint, error message, prefix and suffix slots.
 */
export function TextInput({
  label,
  hint,
  error,
  prefix,
  suffix,
  size = `medium`,
  value,
  defaultValue,
  placeholder,
  type = `text`,
  name,
  id,
  disabled,
  required,
  readOnly,
  onChange,
  onFocus,
  onBlur,
  className,
  style,
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;
  const hasError = Boolean(error);
  const message = hasError ? error : hint;

  return (
    <div
      className={classNames(styles.textInput, styles[size], disabled && styles.disabled, className)}
      style={style}
    >
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {required ? <span className={styles.required}>*</span> : null}
        </label>
      ) : null}
      <div className={classNames(styles.field, hasError && styles.invalid)}>
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <input
          id={inputId}
          className={styles.input}
          type={type}
          name={name}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          readOnly={readOnly}
          aria-invalid={hasError}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={() => onFocus?.()}
          onBlur={() => onBlur?.()}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {message ? (
        <div id={messageId} className={classNames(styles.message, hasError ? styles.errorText : styles.hintText)}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
