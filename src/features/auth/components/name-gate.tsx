import { ClientOnly, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FuwariModal } from "@/components/ui/fuwari-modal";
import { m } from "@/paraglide/messages";
import { AuthHeading } from "./auth-elements";
import { PublicNameForm } from "./public-name-form";
import "./auth-pages.css";

interface NameGateProps {
  user: { name: string } | undefined;
  logout: () => Promise<void>;
}

/**
 * Blocks the site for a signed-in User who has no public name yet, such as
 * one who left the sign-in before the name step. The sign-in page asks for
 * the name itself, so the gate stays out of its way.
 */
export function NameGate({ user, logout }: NameGateProps) {
  const onAuthPage = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId.includes("/_auth")),
  });
  const open = !!user && !user.name.trim() && !onAuthPage;

  return (
    <ClientOnly>
      <FuwariModal open={open} onClose={() => {}} label={m.name_gate_title()}>
        <div className="auth-page name-gate">
          <AuthHeading
            title={m.name_gate_title()}
            description={m.name_gate_desc()}
          />
          <PublicNameForm />
          <Button variant="text" onClick={() => void logout()}>
            {m.profile_logout_fuwari()}
          </Button>
        </div>
      </FuwariModal>
    </ClientOnly>
  );
}
