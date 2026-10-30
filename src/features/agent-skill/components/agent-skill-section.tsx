import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/page-heading";
import { m } from "@/paraglide/messages";
import { InstallStep } from "./install-step";
import { PairedAgents } from "./paired-agents";
import { PairingStep } from "./pairing-step";
import { TryStep } from "./try-step";
import "./agent-skill.css";

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="agent-skill-step">
      <SectionHeading
        level={3}
        size="md"
        title={
          <>
            <Badge tone="primary" size="sm">
              {number}
            </Badge>{" "}
            {title}
          </>
        }
      />
      {children}
    </li>
  );
}

export function AgentSkillSection() {
  return (
    <div className="agent-skill">
      <SectionHeading
        className="settings-section-heading"
        title={m.agent_skill_title()}
        description={m.agent_skill_intro()}
      />
      <ol className="agent-skill-steps">
        <Step number={1} title={m.agent_skill_step_install()}>
          <InstallStep />
        </Step>
        <Step number={2} title={m.agent_skill_step_pair()}>
          <PairingStep />
        </Step>
        <Step number={3} title={m.agent_skill_step_try()}>
          <TryStep />
        </Step>
      </ol>
      <PairedAgents />
    </div>
  );
}
