import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import {
  EmailCode,
  EmailHeading,
  EmailLayout,
  EmailNote,
  EmailText,
} from "./EmailLayout";
import type { EmailSite } from "./email-theme";

interface AuthEmailProps {
  locale: Locale;
  site: EmailSite;
  type: "sign-in-code";
  code: string;
}

export const AuthEmail = ({ locale, site, code }: AuthEmailProps) => {
  const title = m.email_auth_sign_in_code_subject({}, { locale });

  return (
    <EmailLayout locale={locale} previewText={title} site={site}>
      <EmailHeading>{title}</EmailHeading>
      <EmailText>{m.email_auth_sign_in_code_desc({}, { locale })}</EmailText>
      <EmailCode>{code}</EmailCode>
      <EmailNote>{m.email_auth_sign_in_code_expiry({}, { locale })}</EmailNote>
      <EmailNote>{m.email_auth_sign_in_code_ignore({}, { locale })}</EmailNote>
    </EmailLayout>
  );
};
