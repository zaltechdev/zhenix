import Link from "next/link";
import { AuthFormLayout } from "@/components/auth/auth-split-layout";
import { DemoPasswordResetForm } from "@/components/auth/demo-password-reset-form";
import { getRequestLocale } from "@/lib/i18n/request";
import { m } from "@/paraglide/messages.js";

export default async function ForgotPasswordPage() {
  const locale = await getRequestLocale();
  const options = { locale };

  return (
    <AuthFormLayout
      heading={m.auth_forgot_password({}, options)}
      intro={m.auth_forgot_password_intro({}, options)}
    >
      <div className="aksa-auth-forgot-page">
        <p className="aksa-hint" role="status">
          {m.auth_forgot_password_demo_note({}, options)}
        </p>
        <DemoPasswordResetForm
          confirmLabel={m.auth_confirm_new_password_label({}, options)}
          emailInvalidMessage={m.auth_field_email_invalid({}, options)}
          emailLabel={m.auth_email_label({}, options)}
          emailPlaceholder={m.auth_email_placeholder({}, options)}
          failedMessage={m.auth_forgot_password_failed({}, options)}
          mismatchMessage={m.auth_passwords_mismatch({}, options)}
          newPasswordLabel={m.auth_new_password_label({}, options)}
          notFoundMessage={m.auth_forgot_password_not_found({}, options)}
          passwordRequirement={m.auth_password_requirement({ min: "8" }, options)}
          shortMessage={m.auth_field_password_short({ min: "8" }, options)}
          signInActionLabel={m.auth_submit_sign_in({}, options)}
          submitLabel={m.auth_set_new_password({}, options)}
          successMessage={m.auth_forgot_password_demo_success({}, options)}
        />
        <div className="aksa-auth-card__links">
          <Link className="aksa-link" href="/sign-in">
            {m.auth_forgot_password_back({}, options)}
          </Link>
        </div>
      </div>
    </AuthFormLayout>
  );
}
