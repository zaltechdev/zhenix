import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthFormLayout } from "@/components/auth/auth-split-layout";
import { signInAction } from "@/app/(auth)/actions";
import { googleSignInStatus } from "@/lib/server/config/runtime-config";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ oauth_error?: string }>;
}) {
  const locale = await getRequestLocale();
  const query = await searchParams;
  const options = { locale };

  return (
    <AuthFormLayout
      heading={m.auth_sign_in_heading({}, options)}
      intro={m.auth_sign_in_intro({}, options)}
    >
      <AuthForm
        action={signInAction}
        googleSignInEnabled={googleSignInStatus().configured}
        googleSignInFailed={query.oauth_error === "google"}
        links={
          <div className="aksa-auth-card__links">
            <Link className="aksa-link" href="/sign-up">
              {m.auth_switch_to_sign_up({}, options)}
            </Link>
          </div>
        }
        locale={locale}
        mode="sign_in"
        notice={
          <>
            {m.auth_legal_prefix({}, options)}{" "}
            <Link className="aksa-link" href="/">{m.auth_terms({}, options)}</Link>{" "}
            {m.auth_legal_conjunction({}, options)}{" "}
            <Link className="aksa-link" href="/">{m.auth_privacy({}, options)}</Link>
          </>
        }
      />
    </AuthFormLayout>
  );
}
