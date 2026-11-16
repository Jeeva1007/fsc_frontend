import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Toaster, toast } from "sonner";

export type SnackbarVariant = "success" | "error" | "warning" | "info";

export type SnackbarOptions = {
  /** Secondary line under the message. Rendered as plain text. */
  description?: string;
  /** Auto-dismiss time in milliseconds. Defaults depend on the variant. */
  duration?: number;
  /** Optional single action button (e.g. Undo). */
  action?: { label: string; onClick: () => void };
};

// Errors and warnings stay longer so they can be read; success/info clear quickly.
const DEFAULT_DURATION: Record<SnackbarVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

const ICONS: Record<SnackbarVariant, ReactNode> = {
  success: <CircleCheck size={20} />,
  error: <CircleAlert size={20} />,
  warning: <TriangleAlert size={20} />,
  info: <Info size={20} />,
};

type SnackbarProps = SnackbarOptions & {
  variant: SnackbarVariant;
  message: string;
  duration: number;
  onClose: () => void;
};

/** Presentational snackbar card: variant icon, message, optional description/action, close button, countdown bar. */
export function Snackbar({
  variant,
  message,
  description,
  duration,
  action,
  onClose,
}: SnackbarProps) {
  return (
    <div
      className="snackbar"
      data-variant={variant}
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
    >
      <span className="snackbar-icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div className="snackbar-body">
        <strong>{message}</strong>
        {description && <span>{description}</span>}
        {action && (
          <button
            type="button"
            className="snackbar-action"
            onClick={() => {
              action.onClick();
              onClose();
            }}
          >
            {action.label}
          </button>
        )}
      </div>
      <button type="button" className="snackbar-close" aria-label="Dismiss" onClick={onClose}>
        <X size={16} />
      </button>
      <span
        className="snackbar-timer"
        aria-hidden="true"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}

const show = (variant: SnackbarVariant, message: string, options: SnackbarOptions = {}) => {
  const duration = options.duration ?? DEFAULT_DURATION[variant];
  return toast.custom(
    (id) => (
      <Snackbar
        {...options}
        variant={variant}
        message={message}
        duration={duration}
        onClose={() => toast.dismiss(id)}
      />
    ),
    { duration },
  );
};

/** App-wide snackbar API: snackbar.success("Saved"), snackbar.error("Failed", { description, duration }). */
export const snackbar = {
  success: (message: string, options?: SnackbarOptions) => show("success", message, options),
  error: (message: string, options?: SnackbarOptions) => show("error", message, options),
  warning: (message: string, options?: SnackbarOptions) => show("warning", message, options),
  info: (message: string, options?: SnackbarOptions) => show("info", message, options),
  dismiss: (id?: string | number) => toast.dismiss(id),
};

/** Mount once in the root route; shows snackbars at the bottom right. */
export function SnackbarHost() {
  return <Toaster position="bottom-right" visibleToasts={4} gap={12} offset={20} />;
}
