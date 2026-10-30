import { CopyButton } from "@/components/ui/copy-button";

/** A line of text that is meant to be copied, with its copy button. */
export function CopyLine({
  text,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div className="agent-skill-copyline">
      <code>{text}</code>
      <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} />
    </div>
  );
}
