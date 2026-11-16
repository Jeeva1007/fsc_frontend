import type { InputHTMLAttributes, ReactNode } from "react";
import { DateField } from "./date-field";
import { Field, type ControlSize, type ControlVariant } from "./field";

export type TextFieldProps = {
  /** Visible label. Omit to render the bare input (then pass `ariaLabel`). */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  wide?: boolean;
  variant?: ControlVariant;
  size?: ControlSize;
  error?: string | undefined;
  hint?: string | undefined;
  /** Icon or text shown inside the control, before / after the value. */
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  ariaLabel?: string;
  /** Extra native attributes (name, autoComplete, min, max, ...). */
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "placeholder" | "required" | "disabled" | "readOnly"
  >;
};

/**
 * Reusable text input.
 * Variants: `default` (current look), `filled`, `pill`, `underline`; sizes `sm` | `md` | `lg`.
 */
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  wide = false,
  variant = "default",
  size = "md",
  error,
  hint,
  startAdornment,
  endAdornment,
  ariaLabel,
  inputProps,
}: TextFieldProps) {
  // Dates use the shared calendar selector instead of the browser's native picker.
  if (type === "date")
    return (
      <DateField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled || readOnly}
        wide={wide}
        variant={variant}
        size={size}
        error={error}
        hint={hint}
        ariaLabel={ariaLabel}
        min={inputProps?.min as string | undefined}
        max={inputProps?.max as string | undefined}
      />
    );
  const input = (
    <input
      {...inputProps}
      className={`ctl-input ${inputProps?.className ?? ""}`.trim()}
      aria-label={ariaLabel ?? label}
      aria-invalid={error ? true : undefined}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      min={inputProps?.min ?? (type === "number" ? "0" : undefined)}
      step={type === "number" ? "any" : inputProps?.step}
      // A number input changes its value on mouse-wheel while focused; drop focus so scrolling the page
      // never nudges the amount up or down.
      onWheel={
        type === "number"
          ? (e) => {
              e.currentTarget.blur();
              inputProps?.onWheel?.(e);
            }
          : inputProps?.onWheel
      }
    />
  );
  const control =
    startAdornment || endAdornment ? (
      <div
        className="ctl-adorned"
        data-start={startAdornment ? "true" : undefined}
        data-end={endAdornment ? "true" : undefined}
      >
        {startAdornment && <span className="ctl-adornment start">{startAdornment}</span>}
        {input}
        {endAdornment && <span className="ctl-adornment end">{endAdornment}</span>}
      </div>
    ) : (
      input
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
