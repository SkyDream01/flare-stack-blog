import type { ReactNode } from "react";
import type { useLoginForm } from "@/features/auth/hooks/use-login-form";
import type { useSocialLogin } from "@/features/auth/hooks/use-social-login";

export type LoginFormData = ReturnType<typeof useLoginForm> & {
  turnstilePending: boolean;
};

export type SocialLoginData = ReturnType<typeof useSocialLogin>;

export interface LoginPageProps {
  isEmailConfigured: boolean;
  loginForm: LoginFormData;
  socialLogin: SocialLoginData;
  turnstileElement: ReactNode;
}
