import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "./fields";
import { signInSchema, validateForm, type FieldErrors } from "@/lib/login-schema";
import { snackbar } from "@/components/ui/snackbar";
import { BrandLogo } from "./brand-logo";

// Eye button shown inside a password field; toggles between masked and visible text.
// `compact` sizes it for the 38px fields of the app's forms (the login screen's fields are taller).
export function RevealButton({
  shown,
  onToggle,
  label,
  compact = false,
}: {
  shown: boolean;
  onToggle: () => void;
  label: string;
  compact?: boolean;
}) {
  const size = compact ? 16 : 20;
  return (
    <button
      type="button"
      className={compact ? "login-eye eye-compact" : "login-eye"}
      aria-label={`${shown ? "Hide" : "Show"} ${label}`}
      aria-pressed={shown}
      onClick={onToggle}
    >
      {shown ? <EyeOff size={size} /> : <Eye size={size} />}
    </button>
  );
}

// Signs in through POST /api/auth/login ({ username, password }). `onLogin` resolves to an error message
// to show, or null on success. There is no "Forgot password?" (removed at the user's request, 2026-11-10).
export function Login({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<string | null>;
}) {
  const [form, setForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const clear = (field: string) => {
    setFieldErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    try {
      const invalid = validateForm(signInSchema, { username, password });
      if (invalid) return setFieldErrors(invalid);
      const message = await onLogin(username, password);
      if (message) snackbar.error("Sign in failed", { description: message });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-screen">
      {!form ? (
        <button
          type="button"
          className="login-splash"
          aria-label="Open sign in"
          onClick={() => setForm(true)}
        >
          <BrandLogo className="login-splash-logo" />
          <div>
            <strong>FSC</strong>
            <span>Supply Chain redefined.</span>
            <em>Click to sign in →</em>
          </div>
        </button>
      ) : (
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
            <h1>Welcome.</h1>
            <p>Lets get ready to dive in.</p>
            <label>
              Username
              <TextField
                ariaLabel="Username"
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  clear("username");
                }}
                inputProps={{
                  "aria-invalid": fieldErrors["username"] ? true : undefined,
                  autoComplete: "username",
                  autoFocus: true,
                  maxLength: 60,
                }}
              />
              {fieldErrors["username"] && <small role="alert">{fieldErrors["username"]}</small>}
            </label>
            <label>
              Password
              <TextField
                ariaLabel="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  clear("password");
                }}
                inputProps={{
                  "aria-invalid": fieldErrors["password"] ? true : undefined,
                  autoComplete: "current-password",
                  maxLength: 200,
                }}
                endAdornment={
                  <RevealButton
                    shown={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    label="password"
                  />
                }
              />
              {fieldErrors["password"] && <small role="alert">{fieldErrors["password"]}</small>}
            </label>
            <Button type="submit" className="login-submit" disabled={pending}>
              {pending ? "Signing in…" : "Take that bite!"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
