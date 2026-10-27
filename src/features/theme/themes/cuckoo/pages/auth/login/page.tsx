import { Check, Loader2 } from "lucide-react";
import { GithubIcon } from "@/components/common/brand-icon";
import { PublicNameForm } from "@/features/auth/components/public-name-form";
import { SIGN_IN_CODE_LENGTH } from "@/features/auth/utils/sign-in-code";
import type { LoginPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function LoginPage({
  isEmailConfigured,
  loginForm,
  socialLogin,
  turnstileElement,
}: LoginPageProps) {
  const {
    step,
    email,
    error,
    signedIn,
    isSubmitting,
    isResending,
    resendSecondsLeft,
    turnstilePending,
  } = loginForm;
  const busy = isSubmitting || signedIn || socialLogin.isLoading || isResending;
  const heading =
    step === "code"
      ? {
          title: m.login_code_title(),
          description: m.login_code_desc({ email }),
        }
      : step === "name"
        ? { title: m.login_name_title(), description: m.login_name_desc() }
        : { title: m.login_title(), description: m.login_welcome_back() };

  return (
    <div className="flex flex-col gap-8">
      <header className="text-center space-y-2">
        <h1 className="text-2xl font-bold cuckoo-text-90">{heading.title}</h1>
        <p className="text-sm font-medium cuckoo-text-50">
          {heading.description}
        </p>
      </header>

      {step === "email" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={socialLogin.handleGithubLogin}
            disabled={busy}
            className="w-full py-3.5 rounded-xl cuckoo-btn-regular flex items-center justify-center gap-3 font-bold text-sm transition-all disabled:opacity-50"
          >
            {socialLogin.isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <GithubIcon size={16} />
            )}
            {socialLogin.isLoading
              ? m.login_social_connecting()
              : m.login_github_continue()}
          </button>
          {socialLogin.errorMessage && (
            <p role="alert" className="text-sm text-red-500">
              {socialLogin.errorMessage}
            </p>
          )}
          {isEmailConfigured && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex-1 border-t border-border/30" />
              <span>{m.login_email_alternative()}</span>
              <div className="flex-1 border-t border-border/30" />
            </div>
          )}
        </div>
      )}

      {step === "name" ? (
        <PublicNameForm onSaved={loginForm.finish} />
      ) : (
        isEmailConfigured && (
          <form
            onSubmit={loginForm.handleSubmit}
            noValidate
            className="flex flex-col gap-5"
          >
            {step === "email" ? (
              <div key="email" className="flex flex-col gap-2">
                <label
                  htmlFor="login-email"
                  className="text-sm font-bold cuckoo-text-50"
                >
                  {m.login_email_address()}
                </label>
                <input
                  id="login-email"
                  type="email"
                  {...loginForm.emailForm.register("email")}
                  placeholder={m.login_email_placeholder()}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                  required
                  aria-invalid={!!loginForm.emailForm.errors.email}
                  aria-describedby={
                    loginForm.emailForm.errors.email
                      ? "login-email-error"
                      : undefined
                  }
                  className="w-full bg-(--cuckoo-input-bg) border border-(--cuckoo-input-border) rounded-xl px-4 py-3 text-(--cuckoo-text-90) placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-(--cuckoo-primary)/50 transition-all text-sm"
                />
                {loginForm.emailForm.errors.email && (
                  <p
                    id="login-email-error"
                    role="alert"
                    className="text-xs text-red-500"
                  >
                    {loginForm.emailForm.errors.email.message}
                  </p>
                )}
              </div>
            ) : (
              <div key="code" className="flex flex-col gap-2">
                <label
                  htmlFor="login-code"
                  className="text-sm font-bold cuckoo-text-50"
                >
                  {m.login_code_label()}
                </label>
                <input
                  id="login-code"
                  {...loginForm.codeForm.register("code")}
                  inputMode="numeric"
                  autoFocus
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={"0".repeat(SIGN_IN_CODE_LENGTH)}
                  disabled={busy}
                  required
                  aria-invalid={!!loginForm.codeForm.errors.code}
                  aria-describedby={
                    loginForm.codeForm.errors.code
                      ? "login-code-error"
                      : undefined
                  }
                  className="w-full bg-(--cuckoo-input-bg) border border-(--cuckoo-input-border) rounded-xl px-4 py-3 text-(--cuckoo-text-90) placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-(--cuckoo-primary)/50 transition-all text-sm text-center tracking-[0.4em] tabular-nums"
                />
                {loginForm.codeForm.errors.code && (
                  <p
                    id="login-code-error"
                    role="alert"
                    className="text-xs text-red-500"
                  >
                    {loginForm.codeForm.errors.code.message}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <div className="flex justify-center">{turnstileElement}</div>
            <button
              type="submit"
              disabled={busy || (step === "email" && turnstilePending)}
              className="w-full py-3.5 rounded-xl cuckoo-btn-primary font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {signedIn && <Check size={16} />}
              {isSubmitting
                ? step === "email"
                  ? m.login_code_sending()
                  : m.login_submitting()
                : signedIn
                  ? m.login_toast_success()
                  : step === "email"
                    ? m.login_email_submit()
                    : m.login_code_submit()}
            </button>
            {step === "code" && (
              <div className="flex justify-between gap-4">
                <button
                  type="button"
                  onClick={loginForm.resend}
                  disabled={busy || turnstilePending || resendSecondsLeft > 0}
                  className="text-xs font-medium cuckoo-text-50 hover:text-(--cuckoo-primary) disabled:opacity-50"
                >
                  {resendSecondsLeft > 0
                    ? m.login_code_resend_in({
                        seconds: String(resendSecondsLeft),
                      })
                    : m.login_code_resend()}
                </button>
                <button
                  type="button"
                  onClick={loginForm.changeEmail}
                  disabled={busy}
                  className="text-xs font-medium cuckoo-text-50 hover:text-(--cuckoo-primary) disabled:opacity-50"
                >
                  {m.login_code_change_email()}
                </button>
              </div>
            )}
          </form>
        )
      )}
    </div>
  );
}
