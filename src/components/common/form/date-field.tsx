import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayDate, parseIsoDate, toIsoDate } from "@/lib/date-value";
import { Field, type ControlSize, type ControlVariant } from "./field";

export type DateFieldProps = {
  /** Visible label. Omit for the bare control (then pass `ariaLabel`). */
  label?: string | undefined;
  /** "yyyy-mm-dd" or "" when empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  wide?: boolean;
  variant?: ControlVariant;
  size?: ControlSize;
  error?: string | undefined;
  hint?: string | undefined;
  ariaLabel?: string | undefined;
  /** Earliest / latest selectable day, "yyyy-mm-dd". */
  min?: string | undefined;
  max?: string | undefined;
};

const THIS_YEAR = new Date().getFullYear();

/**
 * Reusable date selector: a field-styled button that opens a calendar popover
 * (month and year dropdowns, Today and Clear shortcuts). Value format matches `<input type="date">`.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  required = false,
  disabled = false,
  wide = false,
  variant = "default",
  size = "md",
  error,
  hint,
  ariaLabel,
  min,
  max,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const today = new Date();
  const todayBlocked = (minDate && today < minDate) || (maxDate && today > maxDate);
  const control = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="ctl-adorned date-input"
          data-end="true"
          data-open={open ? "true" : undefined}
        >
          <input
            className="ctl-input"
            readOnly
            disabled={disabled}
            value={selected ? displayDate(selected) : ""}
            placeholder={placeholder}
            aria-label={ariaLabel ?? label}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            onKeyDown={(e) => {
              if (["Enter", " ", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <span className="ctl-adornment end">
            <CalendarDays size={15} aria-hidden="true" />
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="date-pop w-auto p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={new Date(THIS_YEAR - 10, 0)}
          endMonth={new Date(THIS_YEAR + 10, 11)}
          defaultMonth={selected ?? new Date()}
          selected={selected}
          onSelect={(d) => d && pick(toIsoDate(d))}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
        />
        <div className="date-pop-foot">
          <button
            type="button"
            disabled={Boolean(todayBlocked)}
            onClick={() => pick(toIsoDate(today))}
          >
            Today
          </button>
          {!required && (
            <button type="button" disabled={!value} onClick={() => pick("")}>
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
