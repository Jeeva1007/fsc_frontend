import * as yup from "yup";
import { MIN_PASSWORD, validateForm, type FieldErrors } from "./login-schema";

export { MIN_PASSWORD };

/** Minimum password length in the Add/Edit User pop-up only (user request, 2026-11-13); sign-in and the
 * first-login password change keep MIN_PASSWORD. */
export const USER_FORM_MIN_PASSWORD = 5;

// Limits mirror the backend UserManagementRequest schema; the server still enforces them.
export const USER_LIMITS = {
  name: 120,
  username: 60,
  short: 120,
  email: 160,
  location: 120,
  password: 72,
  /** A Receiver's free-text Payment alert; the backend has no limit yet, 255 matches a usual text column. */
  paymentAlert: 255,
} as const;

const text = (label: string, max: number) =>
  yup.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

const passwordRules = (s: yup.StringSchema<string | undefined>) =>
  s
    .max(USER_LIMITS.password, `Password must be ${USER_LIMITS.password} characters or fewer.`)
    .test("min", `Password must be at least ${USER_FORM_MIN_PASSWORD} characters.`, (v) =>
      !v ? true : v.length >= USER_FORM_MIN_PASSWORD,
    );

/** Yup rules for the Add/Edit User form. `taken` are other members' User IDs; `isNew` makes the password required. */
export const userSchema = (taken: string[], isNew: boolean) =>
  yup.object({
    name: text("Full Name", USER_LIMITS.name).required("Enter the full name."),
    username: text("User ID", USER_LIMITS.username)
      .required("Enter a user ID.")
      .matches(/^[A-Za-z0-9._@-]+$/, "Use letters, numbers and . _ @ - only.")
      .test("unique", "This User ID already exists.", (v) => !v || !taken.includes(v)),
    short: text("Display Name", USER_LIMITS.short).required("Enter the display name."),
    // Passwords are never trimmed.
    password: passwordRules(isNew ? yup.string().required("Enter a password.") : yup.string()),
  });

export const validateUser = (
  values: {
    name: string;
    username: string;
    short: string;
    password: string;
  },
  taken: string[],
  isNew: boolean,
): FieldErrors | null => validateForm(userSchema(taken, isNew), values);
