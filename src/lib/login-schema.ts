import * as yup from "yup";

export const MIN_PASSWORD = 10;

// Limits mirror the backend OpenAPI schemas (SignIn, ResetRequest, Reset); the server still enforces them.
const username = yup
  .string()
  .trim()
  .required("Enter your username.")
  .max(60, "Username must be 60 characters or fewer.");
// Passwords are never trimmed: leading/trailing spaces may be intentional.
const password = (message: string) =>
  yup.string().required(message).max(200, "Password must be 200 characters or fewer.");

export const signInSchema = yup.object({
  username,
  password: password("Enter your password."),
});

export const resetRequestSchema = yup.object({ username });

export const resetSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required("Enter the reset code.")
    .max(100, "Reset code must be 100 characters or fewer."),
  // The backend rejects shorter new passwords with "at least 10 characters".
  newPassword: password("Enter a new password.").min(
    MIN_PASSWORD,
    `Password must be at least ${MIN_PASSWORD} characters.`,
  ),
  confirm: yup
    .string()
    .required("Confirm your new password.")
    .oneOf([yup.ref("newPassword")], "Passwords do not match."),
});

export type FieldErrors = Record<string, string>;

/**
 * Turns a failed /auth/reset-request or /auth/reset response into what the form shows: the backend's
 * per-field reasons for the fields on screen, otherwise one message. Never reveals whether a username exists.
 */
export function resetFailure(error: unknown, formFields: string[]): FieldErrors | string {
  const { status, data } = (error ?? {}) as { status?: unknown; data?: unknown };
  const body = (typeof data === "object" && data !== null ? data : {}) as {
    message?: unknown;
    fields?: unknown;
  };
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (status === 403 && typeof body.message === "string" && body.message) return body.message;
  if (status === 400 && Array.isArray(body.fields)) {
    const found: FieldErrors = {};
    for (const f of body.fields as { field?: unknown; problem?: unknown }[]) {
      if (typeof f?.field !== "string" || typeof f.problem !== "string") continue;
      if (formFields.includes(f.field) && !found[f.field])
        found[f.field] = f.problem.charAt(0).toUpperCase() + f.problem.slice(1) + ".";
    }
    if (Object.keys(found).length) return found;
  }
  return formFields.includes("code") && (status === 400 || status === 401 || status === 404)
    ? "The reset code is invalid or has expired."
    : "Unable to reach the server. Please try again.";
}

// Returns the first error per field, or null when the values are valid.
// `context` reaches tests through this.options.context (e.g. a count other fields depend on).
export function validateForm(
  schema: yup.AnyObjectSchema,
  values: object,
  context?: object,
): FieldErrors | null {
  try {
    schema.validateSync(values, { abortEarly: false, context });
    return null;
  } catch (e) {
    if (!(e instanceof yup.ValidationError)) throw e;
    const errors: FieldErrors = {};
    for (const err of e.inner) if (err.path && !errors[err.path]) errors[err.path] = err.message;
    return errors;
  }
}
