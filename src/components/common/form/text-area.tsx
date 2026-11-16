import type { TextareaHTMLAttributes } from "react";
import { Field, type ControlSize, type ControlVariant } from "./field";

export type TextAreaProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  wide?: boolean;
  variant?: ControlVariant;
  size?: ControlSize;
  error?: string | undefined;
  hint?: string | undefined;
  rows?: number;
  ariaLabel?: string;
  /** Extra native attributes (autoFocus, maxLength, name, ...). */
  textareaProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange" | "placeholder" | "required" | "disabled" | "readOnly" | "rows"
  >;
};

/** Reusable multi-line input; shares the Field label/variant/message system with TextField. */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  wide = false,
  variant = "default",
  size = "md",
  error,
  hint,
  rows,
  ariaLabel,
  textareaProps,
}: TextAreaProps) {
  const control = (
    <textarea
      {...textareaProps}
      className={`ctl-input ${textareaProps?.className ?? ""}`.trim()}
      aria-label={ariaLabel ?? label}
      aria-invalid={error ? true : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      rows={rows}
    />
  );
  if (!label) return control;
  return (
    <Field
      label={label}
      required={required}
      wide={wide}
      variant={variant}
      size={size}
      error={error}
      hint={hint}
    >
      {control}
    </Field>
  );
}
