import type { ReactNode } from "react";

export type ControlVariant = "default" | "filled" | "pill" | "underline";
export type ControlSize = "sm" | "md" | "lg";

export type FieldProps = {
  label: string;
  children: ReactNode;
  /** Spans the full width of a multi-column form grid. */
  wide?: boolean;
  required?: boolean;
  variant?: ControlVariant;
  size?: ControlSize;
  /** Validation message; also marks the control as invalid. */
  error?: string | undefined;
  /** Helper text shown under the control when there is no error. */
  hint?: string | undefined;
  className?: string;
};

/** Label + control + message wrapper shared by every form control. */
export function Field({
  label,
  children,
  wide = false,
  required = false,
  variant = "default",
  size = "md",
  error,
  hint,
  className = "",
}: FieldProps) {
  return (
    <div
      className={`field ${wide ? "field-wide" : ""} ${className}`.trim()}
      data-variant={variant}
      data-size={size}
      data-invalid={error ? "true" : undefined}
    >
      <div className="field-label">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </div>
      {children}
      {error ? (
        <small className="field-message error" role="alert">
          {error}
        </small>
      ) : (
        hint && <small className="field-message">{hint}</small>
      )}
    </div>
  );
}
