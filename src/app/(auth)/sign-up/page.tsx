import Link from "next/link";
import { m } from "@/paraglide/messages.js";
import { getRequestLocale } from "@/lib/i18n/request";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthFormLayout } from "@/components/auth/auth-split-layout";
import { signUpAction } from "@/app/(auth)/actions";

export default async function SignUpPage() {
  const locale = await getRequestLocale();
  const options = { locale };

  return (
    <AuthFormLayout
      heading={m.auth_sign_up_heading({}, options)}
      intro={m.auth_sign_up_intro({}, options)}
    >
      <AuthForm
        action={signUpAction}
        links={
          <div className="aksa-auth-card__links">
            <Link className="aksa-link" href="/sign-in">
              {m.auth_switch_to_sign_in({}, options)}
            </Link>
          </div>
        }
        locale={locale}
        mode="sign_up"
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
