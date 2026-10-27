// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoginPageProps } from "../contract/pages";
import { LoginPage as CuckooLogin } from "../themes/cuckoo/pages/auth/login/page";
import { LoginPage as DefaultLogin } from "../themes/default/pages/auth/login/page";
import { LoginPage as FuwariLogin } from "../themes/fuwari/pages/auth/login/page";
import { m } from "@/paraglide/messages";

vi.mock("@/features/auth/components/public-name-form", () => ({
  PublicNameForm: ({ onSaved }: { onSaved: () => void }) =>
    createElement("button", { onClick: onSaved }, "Save public name"),
}));

afterEach(cleanup);

function props(): LoginPageProps {
  return {
    isEmailConfigured: true,
    turnstileElement: createElement("div", { "data-testid": "turnstile" }),
    socialLogin: {
      isLoading: false,
      errorMessage: null,
      turnstilePending: false,
      handleGithubLogin: vi.fn(),
    },
    loginForm: {
      step: "email",
      email: "reader@example.com",
      error: null,
      signedIn: false,
      isResending: false,
      resendSecondsLeft: 0,
      emailForm: { register: vi.fn(), errors: {} },
      codeForm: { register: vi.fn(), errors: {} },
      isSubmitting: false,
      turnstilePending: false,
      handleSubmit: vi.fn(async (event) => event?.preventDefault()),
      resend: vi.fn(),
      changeEmail: vi.fn(),
      finish: vi.fn(),
    },
  };
}

describe.each([
  ["default", DefaultLogin],
  ["fuwari", FuwariLogin],
  ["cuckoo", CuckooLogin],
] as const)("%s sign-in", (_theme, LoginPage) => {
  it("offers GitHub and email codes without password or registration controls", () => {
    const data = props();
    const view = render(createElement(LoginPage, data));
    expect(view.getByLabelText(m.login_email_address())).toBeTruthy();
    expect(view.getByTestId("turnstile")).toBeTruthy();
    expect(
      view.container.querySelector('input[type="password"], a'),
    ).toBeNull();
    fireEvent.click(
      view.getByRole("button", { name: m.login_github_continue() }),
    );
    expect(data.socialLogin.handleGithubLogin).toHaveBeenCalledOnce();
    fireEvent.submit(view.container.querySelector("form")!);
    expect(data.loginForm.handleSubmit).toHaveBeenCalledOnce();
  });

  it("offers only GitHub when email delivery is not configured", () => {
    const data = { ...props(), isEmailConfigured: false };
    const view = render(createElement(LoginPage, data));
    expect(view.queryByRole("textbox")).toBeNull();
    expect(view.queryByTestId("turnstile")).toBeNull();
    expect(
      view.getByRole("button", { name: m.login_github_continue() }),
    ).toBeTruthy();
  });

  it("shows server errors and prevents duplicate requests while submitting", () => {
    const data = props();
    data.loginForm.error = "Try again in 30 seconds";
    data.loginForm.isSubmitting = true;
    const view = render(createElement(LoginPage, data));
    expect(view.getByRole("alert").textContent).toContain(data.loginForm.error);
    for (const button of view.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect((view.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("surfaces GitHub sign-in failures", () => {
    const data = props();
    data.socialLogin.errorMessage = "GitHub is unavailable";
    const view = render(createElement(LoginPage, data));
    expect(view.getByRole("alert").textContent).toBe(
      data.socialLogin.errorMessage,
    );
  });

  it("verifies a code while Turnstile refreshes and enforces the resend cooldown", () => {
    const data = props();
    data.loginForm.step = "code";
    data.loginForm.turnstilePending = true;
    data.loginForm.resendSecondsLeft = 25;
    const view = render(createElement(LoginPage, data));
    const code = view.getByLabelText(m.login_code_label()) as HTMLInputElement;
    expect(code.autocomplete).toBe("one-time-code");
    expect(code.inputMode).toBe("numeric");
    expect(view.queryByLabelText(m.login_email_address())).toBeNull();
    const submit = view.getByRole("button", {
      name: m.login_code_submit(),
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(data.loginForm.handleSubmit).toHaveBeenCalledOnce();
    const resend = view.getByRole("button", {
      name: m.login_code_resend_in({ seconds: "25" }),
    });
    fireEvent.click(resend);
    expect(data.loginForm.resend).not.toHaveBeenCalled();
    data.loginForm = {
      ...data.loginForm,
      turnstilePending: false,
      resendSecondsLeft: 0,
    };
    view.rerender(createElement(LoginPage, data));
    fireEvent.click(view.getByRole("button", { name: m.login_code_resend() }));
    expect(data.loginForm.resend).toHaveBeenCalledOnce();
    fireEvent.click(
      view.getByRole("button", { name: m.login_code_change_email() }),
    );
    expect(data.loginForm.changeEmail).toHaveBeenCalledOnce();
  });

  it("finishes through the public-name step without showing code or GitHub controls", () => {
    const data = props();
    data.loginForm.step = "name";
    const view = render(createElement(LoginPage, data));
    expect(view.getByRole("heading").textContent).toBe(m.login_name_title());
    expect(view.queryByRole("textbox")).toBeNull();
    expect(view.queryByTestId("turnstile")).toBeNull();
    expect(
      view.queryByRole("button", { name: m.login_github_continue() }),
    ).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Save public name" }));
    expect(data.loginForm.finish).toHaveBeenCalledOnce();
  });
});
