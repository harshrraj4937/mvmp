import type { MadeHow } from "~/modules/catalog/domain/constants";

const LABELS: Record<MadeHow, string> = {
  HANDMADE: "Handmade",
  HOMEMADE: "Homemade",
};

export function MadeBadge({ madeHow }: { madeHow: MadeHow | null }) {
  if (!madeHow) {
    return null;
  }
  return <span className="made-badge">{LABELS[madeHow]}</span>;
}
