import * as yup from "yup";
import { MIN_PASSWORD, USER_LIMITS } from "./user-schema";

/** Yup rules for the forced first-login password change (POST /auth/password). Passwords are never trimmed. */
export const changePasswordSchema = yup.object({
  currentPassword: yup
    .string()
    .required("Enter your temporary password.")
    .max(USER_LIMITS.password, `Password must be ${USER_LIMITS.password} characters or fewer.`),
  newPassword: yup
    .string()
    .required("Enter a new password.")
    .min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters.`)
    .max(USER_LIMITS.password, `Password must be ${USER_LIMITS.password} characters or fewer.`)
    .notOneOf([yup.ref("currentPassword")], "Choose a password different from the temporary one."),
  confirm: yup
    .string()
    .required("Confirm your new password.")
    .oneOf([yup.ref("newPassword")], "Passwords do not match."),
});
