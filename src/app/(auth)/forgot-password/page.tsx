import Link from "next/link";
import { AuthFormLayout } from "@/components/auth/auth-split-layout";
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
        <div className="aksa-auth-card__links">
          <Link className="aksa-link" href="/sign-in">
            {m.auth_forgot_password_back({}, options)}
          </Link>
        </div>
      </div>
    </AuthFormLayout>
  );
}
