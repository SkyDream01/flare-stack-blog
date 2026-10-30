import { m } from "@/paraglide/messages";
import { CopyLine } from "./copy-line";

const EXAMPLES = [
  () => m.agent_skill_try_list_drafts(),
  () => m.agent_skill_try_notes(),
  () => m.agent_skill_try_publish(),
  () => m.agent_skill_try_summaries(),
];

export function TryStep() {
  return (
    <>
      <p className="agent-skill-hint">{m.agent_skill_try_hint()}</p>
      <ul className="agent-skill-examples">
        {EXAMPLES.map((example) => (
          <li key={example()}>
            <CopyLine
              text={example()}
              copyLabel={m.agent_skill_try_copy()}
              copiedLabel={m.agent_skill_try_copied()}
            />
          </li>
        ))}
      </ul>
      <p className="agent-skill-hint">{m.agent_skill_try_note()}</p>
    </>
  );
}
