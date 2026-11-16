import { useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { snackbar } from "@/components/ui/snackbar";
import { validateForm, type FieldErrors } from "@/lib/login-schema";
import { changePasswordSchema } from "@/lib/password-schema";
import { MIN_PASSWORD } from "@/lib/user-schema";
import { RevealButton } from "./login";
import { TextField } from "./fields";
import { BrandLogo } from "./brand-logo";

// Shown instead of the whole workspace while the server says mustChangePassword (new or reset accounts).
// `onSubmit` resolves to an error message, or null once the password has been changed.
export function ChangePassword({
  name,
  onSubmit,
  onSignOut,
}: {
  name: string;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<string | null>;
  onSignOut: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const clear = (field: string) => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  const rules = [
    { ok: next.length >= MIN_PASSWORD, text: `At least ${MIN_PASSWORD} characters` },
    { ok: next !== "" && next !== current, text: "Different from the temporary password" },
    { ok: confirm !== "" && confirm === next, text: "Both new passwords match" },
  ];

  const submit = async () => {
    if (pending) return;
    const invalid = validateForm(changePasswordSchema, {
      currentPassword: current,
      newPassword: next,
      confirm,
    });
    if (invalid) return setErrors(invalid);
    setPending(true);
    try {
      const message = await onSubmit(current, next);
      if (message) snackbar.error("Password not changed", { description: message });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <aside className="login-brand">
          <BrandLogo className="login-brand-logo" />
          <h2>FSC</h2>
        </aside>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h1>Hi {name}</h1>
          <p>Set a new password to continue.</p>
          <label>
            Temporary password
            <TextField
              ariaLabel="Temporary password"
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(v) => {
                setCurrent(v);
                clear("currentPassword");
              }}
              inputProps={{
                "aria-invalid": errors["currentPassword"] ? true : undefined,
                autoComplete: "current-password",
                autoFocus: true,
              }}
              endAdornment={
                <RevealButton
                  shown={showCurrent}
                  onToggle={() => setShowCurrent((v) => !v)}
                  label="temporary password"
                />
              }
            />
            {errors["currentPassword"] && <small role="alert">{errors["currentPassword"]}</small>}
          </label>
          <label>
            New password
            <TextField
              ariaLabel="New password"
              type={showNext ? "text" : "password"}
              value={next}
              onChange={(v) => {
                setNext(v);
                clear("newPassword");
              }}
              inputProps={{
                "aria-invalid": errors["newPassword"] ? true : undefined,
                autoComplete: "new-password",
              }}
              endAdornment={
                <RevealButton
                  shown={showNext}
                  onToggle={() => setShowNext((v) => !v)}
                  label="new password"
                />
              }
            />
            {errors["newPassword"] && <small role="alert">{errors["newPassword"]}</small>}
          </label>
          <label>
            Confirm new password
            <TextField
              ariaLabel="Confirm new password"
              type={showNext ? "text" : "password"}
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                clear("confirm");
              }}
              inputProps={{
                "aria-invalid": errors["confirm"] ? true : undefined,
                autoComplete: "new-password",
              }}
            />
            {errors["confirm"] && <small role="alert">{errors["confirm"]}</small>}
          </label>
          <ul className="pw-rules" aria-label="Password requirements">
            {rules.map((r) => (
              <li key={r.text} data-ok={r.ok ? "true" : undefined}>
                <span aria-hidden="true">
                  {r.ok ? <Check size={12} /> : <LockKeyhole size={11} />}
                </span>
                {r.text}
              </li>
            ))}
          </ul>
          <Button type="submit" className="login-submit" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
          <div className="login-aux center">
            <button type="button" className="login-link" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
