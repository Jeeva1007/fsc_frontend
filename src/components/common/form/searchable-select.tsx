import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, type ControlSize, type ControlVariant } from "./field";

export type SelectOption = string | { value: string; label?: string };

export type SearchableSelectProps = {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Lets the user add a value that is not in `options` ("Add “x”"). */
  create?: boolean;
  /**
   * `input`: type directly in the control (default).
   * `button`: a select-style button that opens a menu with a search box.
   */
  trigger?: "input" | "button";
  variant?: ControlVariant;
  size?: ControlSize;
  disabled?: boolean;
  required?: boolean;
  wide?: boolean;
  /** Shows a clear button when a value is selected. */
  clearable?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  emptyText?: string;
  ariaLabel?: string;
  /** Extra class on the control wrapper (for local sizing/skin overrides). */
  className?: string;
  /**
   * `fixed` positions the menu against the viewport so it is not clipped inside
   * scrolling or overflow-hidden containers such as table cells.
   */
  menuPlacement?: "absolute" | "fixed";
  /** Button trigger only: false leaves out the search box, for short lists such as rows per page. */
  searchable?: boolean;
};

const MENU_MAX = 190;
const MENU_GAP = 2;
const SCREEN_MARGIN = 8;
const OPTION_HEIGHT = 36;
const SEARCH_HEIGHT = 46;

/**
 * Where a fixed menu goes: below the control, or above it when it would not fit and there is more room
 * there. Its height is limited to the room available, so every option can always be reached.
 */
export function placeMenu(
  control: { top: number; bottom: number },
  viewportHeight: number,
  menuHeight: number,
): { top?: number; bottom?: number; maxHeight: number } {
  const below = viewportHeight - control.bottom - MENU_GAP - SCREEN_MARGIN;
  const above = control.top - MENU_GAP - SCREEN_MARGIN;
  const wanted = Math.min(menuHeight, MENU_MAX);
  return wanted > below && above > below
    ? { bottom: viewportHeight - control.top + MENU_GAP, maxHeight: Math.min(MENU_MAX, above) }
    : { top: control.bottom + MENU_GAP, maxHeight: Math.min(MENU_MAX, Math.max(below, 80)) };
}

const normalize = (option: SelectOption) =>
  typeof option === "string"
    ? { value: option, label: option }
    : { value: option.value, label: option.label ?? option.value };

/**
 * Reusable searchable dropdown. Single select, optional "add new" entry.
 * Variants: `default` (current look), `filled`, `pill`, `underline`; sizes `sm` | `md` | `lg`.
 */
export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  create = false,
  trigger = "input",
  variant = "default",
  size = "md",
  disabled = false,
  required = false,
  wide = false,
  clearable = false,
  error,
  hint,
  emptyText = "No matches",
  ariaLabel,
  className = "",
  menuPlacement = "absolute",
  searchable = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<
    (ReturnType<typeof placeMenu> & { left: number; width: number }) | null
  >(null);
  const fixed = menuPlacement === "fixed";
  useEffect(() => {
    if (!open || !fixed) return;
    // Scrolling the page would leave the menu behind, but scrolling inside the menu must not close it.
    const close = (e: Event) => {
      if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, fixed]);
  const toggle = () => {
    if (!open && fixed && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const search = trigger === "button" && searchable ? SEARCH_HEIGHT : 0;
      setPos({
        ...placeMenu(rect, window.innerHeight, search + options.length * OPTION_HEIGHT + 10),
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(!open);
  };
  const name = ariaLabel ?? label ?? "Select";
  const all = [
    ...new Map(
      [...options.map(normalize), ...added.map((v) => ({ value: v, label: v }))].map((o) => [
        o.value,
        o,
      ]),
    ).values(),
  ];
  const needle = query.toLowerCase();
  const filtered = all.filter((o) => o.label.toLowerCase().includes(needle));
  const text = query.trim();
  // "Chennai" or "CHN" must not offer to add what is already listed as "Chennai (CHN)".
  const typed = text.toLowerCase();
  const canCreate =
    create &&
    text &&
    !all.some(
      (o) =>
        o.label.toLowerCase() === typed ||
        o.value.toLowerCase() === typed ||
        o.label.toLowerCase().startsWith(`${typed} (`),
    );
  const shown = all.find((o) => o.value === value)?.label ?? value;
  const fallback = placeholder || `Select ${name.toLowerCase()}`;

  const choose = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };
  const addAndChoose = () => {
    setAdded([...added, text]);
    choose(text);
  };
  const onEnter = () => {
    if (filtered[0]) choose(filtered[0].value);
    else if (create && text) addAndChoose();
  };

  const clear = clearable && value && !disabled && (
    <button
      type="button"
      className="ctl-clear"
      aria-label={`Clear ${name}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => choose("")}
    >
      <X size={13} />
    </button>
  );

  const showSearch = trigger === "button" && searchable;
  // Without a search box, keyboard users move through the options directly.
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (showSearch) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      setOpen(false);
      wrapRef.current?.querySelector("button")?.focus();
    }
  };
  const menu = open && (
    <div
      ref={menuRef}
      id={id}
      role="listbox"
      className="combo-menu"
      onKeyDown={onMenuKey}
      style={
        fixed && pos
          ? {
              position: "fixed",
              top: pos.top ?? "auto",
              bottom: pos.bottom ?? "auto",
              maxHeight: pos.maxHeight,
              left: pos.left,
              right: "auto",
              minWidth: pos.width,
              width: "max-content",
            }
          : undefined
      }
    >
      {showSearch && (
        <div className="ctl-menu-search">
          <Search size={13} />
          <input
            autoFocus
            aria-label={`Search ${name}`}
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
          />
        </div>
      )}
      {filtered.map((option) => (
        <Button
          type="button"
          variant="ghost"
          role="option"
          aria-selected={value === option.value}
          autoFocus={!showSearch && trigger === "button" && value === option.value}
          key={option.value}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => choose(option.value)}
        >
          {option.label}
          {value === option.value && <Check size={14} />}
        </Button>
      ))}
      {canCreate && (
        <Button
          type="button"
          variant="ghost"
          className="text-primary ctl-add"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addAndChoose}
        >
          <Plus size={14} />
          Add “{text}”
        </Button>
      )}
      {!filtered.length && !create && <p className="empty-small">{emptyText}</p>}
    </div>
  );

  const control =
    trigger === "input" ? (
      <div className={`combo ${className}`.trim()}>
        <div className="combo-input">
          <input
            className="ctl-input"
            role="combobox"
            aria-label={name}
            aria-expanded={open}
            aria-controls={id}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            required={required}
            value={open ? query : shown}
            placeholder={fallback}
            onFocus={() => {
              setOpen(true);
              setQuery("");
            }}
            // The input keeps focus after a choice, so focus alone cannot reopen the list: a click does.
            onClick={() => {
              if (open) return;
              setOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown" && !open) {
                e.preventDefault();
                setOpen(true);
                setQuery("");
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (open) onEnter();
                else {
                  setOpen(true);
                  setQuery("");
                }
              }
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {clear}
          <ChevronDown size={15} />
        </div>
        {menu}
      </div>
    ) : (
      <div
        ref={wrapRef}
        className={`combo ${className}`.trim()}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setOpen(false);
            setQuery("");
          }
        }}
      >
        <Button
          type="button"
          variant="outline"
          className="agency-trigger ctl-trigger"
          aria-label={name}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onClick={toggle}
        >
          <span className={shown ? "" : "ctl-placeholder"}>{shown || fallback}</span>
          {clear}
          <ChevronDown size={15} />
        </Button>
        {menu}
      </div>
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
