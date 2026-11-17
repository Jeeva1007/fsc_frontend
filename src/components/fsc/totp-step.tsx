import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { TotpSetup } from "@/lib/auth-session";
import { safeImageSrc } from "@/lib/security";

/** A failed code check. `restart` sends the member back to the password form (the sign-in ran out). */
export type TotpVerifyError = { error: string; restart?: boolean };

/**
 * The Google Authenticator step of sign-in, shown in the login card after the password was accepted but
 * the member's 15-day authenticator access ran out. Loads the QR code (POST /auth/totp/setup) once, then
 * checks the 6-digit code (POST /auth/totp/verify), which signs the member in.
 */
export function TotpStep({
  onSetup,
  onVerify,
  onBack,
}: {
  onSetup: () => Promise<TotpSetup | { error: string }>;
  onVerify: (code: string) => Promise<TotpVerifyError | null>;
  onBack: (message?: string) => void;
}) {
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const digits = setup?.digits ?? 6;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const result = await onSetup();
    if ("error" in result) setLoadError(result.error);
    else setSetup(result);
    setLoading(false);
  }, [onSetup]);

  // Once on mount; the ref keeps React StrictMode's double effect from sending two requests.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  // The boxes are disabled until the QR code loads, so autoFocus alone misses: focus them once usable.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (setup && !pending) input.current?.focus();
  }, [setup, pending]);

  const verify = async (value: string) => {
    if (pending) return;
    if (value.length !== digits) return setError(`Enter the ${digits}-digit code.`);
    setPending(true);
    try {
      const result = await onVerify(value);
      if (!result) return;
      if (result.restart) return onBack(result.error);
      setError(result.error);
      setCode("");
    } finally {
      setPending(false);
    }
  };

  const qr = safeImageSrc(setup?.qrCodeImage);
  const disabled = pending || !setup;

  return (
    <form
      noValidate
      className="totp-step"
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
    >
      <h1>Verify it&apos;s you.</h1>
      <p>
        Scan the QR code with Google Authenticator, then enter the {digits}-digit code it shows
        {setup?.validDays ? ` — this keeps you signed in for ${setup.validDays} days.` : "."}
      </p>
      <div className="totp-qr" aria-busy={loading}>
        {qr ? (
          <img
            src={qr}
            alt={`QR code for ${setup?.issuer ?? "FSC"} (${setup?.accountName ?? ""})`}
          />
        ) : loadError ? (
          <div role="alert" className="totp-load-error">
            {loadError}
            <button type="button" className="login-link" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <span className="totp-loading">Loading QR code…</span>
        ) : null}
      </div>
      {setup?.manualEntryKey && (
        <div className="login-aux center totp-key">
          {showKey ? (
            <span>
              Setup key: <code>{setup.manualEntryKey}</code>
            </span>
          ) : (
            <button type="button" className="login-link" onClick={() => setShowKey(true)}>
              Can&apos;t scan? Enter a setup key instead
            </button>
          )}
        </div>
      )}
      <label>
        Authenticator code
        <InputOTP
          ref={input}
          maxLength={digits}
          value={code}
          onChange={(v) => {
            const next = v.replace(/\D/g, "").slice(0, digits);
            setCode(next);
            setError("");
            if (next.length === digits) void verify(next);
          }}
          inputMode="numeric"
          pattern="^[0-9]*$"
          autoComplete="one-time-code"
          autoFocus
          aria-label="Authenticator code"
          aria-invalid={error ? true : undefined}
          containerClassName="totp-code"
          disabled={disabled}
        >
          <InputOTPGroup>
            {Array.from({ length: digits }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error && <small role="alert">{error}</small>}
      </label>
      <Button type="submit" className="login-submit" disabled={disabled}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
      <div className="login-aux center">
        <button type="button" className="login-link" onClick={() => onBack()}>
          ← Back to sign in
        </button>
      </div>
    </form>
  );
}
