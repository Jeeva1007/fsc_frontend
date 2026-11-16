import { useId, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  SearchableSelect,
  type SearchableSelectProps,
  type SelectOption,
} from "@/components/common/form";
import { agencyOptions, type AgencyOption } from "@/lib/master-choices";
import { TextField } from "@/components/common/form";
export { Field, TextArea, TextField } from "@/components/common/form";

/** Searchable, createable dropdown (existing look): a thin preset of SearchableSelect. */
export function Combo(props: Omit<SearchableSelectProps, "create"> & { create?: boolean }) {
  // Every form dropdown shows a × to clear the selection (opt out with clearable={false}).
  return (
    <SearchableSelect
      {...props}
      create={props.create ?? true}
      clearable={props.clearable ?? true}
    />
  );
}
/** Toolbar filter: a button dropdown whose first entry (empty value) means "all". */
export function FilterSelect({
  ariaLabel,
  allLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  allLabel: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SearchableSelect
      trigger="button"
      size="sm"
      ariaLabel={ariaLabel}
      options={[{ value: "", label: allLabel }, ...options]}
      value={value}
      onChange={onChange}
      clearable
    />
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search shipments…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={16} />
      <TextField
        ariaLabel={placeholder ?? "Search"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      {value && (
        <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => onChange("")}>
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const s = status ? status.toLowerCase() : "";
  const color =
    s.includes("delivered") || s.includes("ready for delivery") || s === "active"
      ? "success"
      : s.includes("awaiting") || s.includes("received") || s === "inactive"
        ? "warning"
        : s === "filed"
          ? "neutral"
          : "info";
  return (
    <span className={`status-badge ${color}`}>
      <i />
      {status}
    </span>
  );
}

/**
 * Linked Agencies: several can be picked. It looks and opens like the form's other dropdowns (the
 * SearchableSelect input), with a checkbox on each agency; the menu stays open while ticking. The value is a
 * ", "-joined list of codes, as before; the box shows the codes, the menu each code with its name.
 */
export function AgencyDropdown({
  value,
  onChange,
  options = agencyOptions(undefined),
}: {
  value: string;
  onChange: (value: string) => void;
  /** The agencies to offer (the server's linked agency list); the built-in four by default. */
  options?: AgencyOption[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = value.split(", ").filter(Boolean);
  const toggle = (agency: string) =>
    onChange(
      (selected.includes(agency)
        ? selected.filter((a) => a !== agency)
        : [...selected, agency]
      ).join(", "),
    );
  // The input keeps focus while options are clicked, so the menu closes only when focus leaves.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <Field label="Linked Agencies">
      <div
        className="combo agency-picker"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <div className="combo-input">
          <input
            className="ctl-input"
            readOnly
            role="combobox"
            aria-label="Linked Agencies"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={id}
            value={value}
            title={value || undefined}
            placeholder="Select agencies"
            onClick={() => setOpen(!open)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" || e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          {value && (
            <button
              type="button"
              className="ctl-clear"
              aria-label="Clear Linked Agencies"
              onMouseDown={keepFocus}
              onClick={() => onChange("")}
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={15} />
        </div>
        {open && (
          <div
            id={id}
            role="listbox"
            aria-label="Linked Agencies"
            aria-multiselectable="true"
            className="combo-menu"
          >
            <div className="agency-actions">
              <Button
                type="button"
                variant="link"
                onMouseDown={keepFocus}
                onClick={() => onChange(options.map((o) => o.code).join(", "))}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="link"
                onMouseDown={keepFocus}
                onClick={() => onChange("")}
              >
                Clear All
              </Button>
            </div>
            {options.map(({ code, name }) => (
              <Button
                type="button"
                variant="ghost"
                role="option"
                className="agency-option-row"
                aria-selected={selected.includes(code)}
                aria-label={name ? `${code} – ${name}` : code}
                key={code}
                onMouseDown={keepFocus}
                onClick={() => toggle(code)}
              >
                {/* Shows the state only: the option itself is the control, so the box takes no clicks. */}
                <input
                  type="checkbox"
                  tabIndex={-1}
                  aria-hidden="true"
                  readOnly
                  checked={selected.includes(code)}
                />
                <span className="agency-code">{code}</span>
                {name && <span className="agency-name">{name}</span>}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}
