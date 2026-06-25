import type { ExtraCol } from "@/components/SeasonsRankTable";
import { buildDesafioBreakdownBySubject, type DesafioResult, type Subject } from "@/lib/fm-desafios";
import { fmtPts } from "@/lib/fmt";

/**
 * Build an "Desafios" ExtraCol showing how many points each entity earned from challenges,
 * with a tooltip listing the completed challenges (name, bonus, years).
 */
export function buildDesafioExtraCol(
  results: DesafioResult[] | undefined,
  subject: Subject,
): ExtraCol | null {
  if (!results?.length) return null;
  const breakdown = buildDesafioBreakdownBySubject(results, subject);
  const entries = Object.entries(breakdown);
  if (!entries.length) return null;
  const values: Record<string, number> = {};
  const tips: Record<string, React.ReactNode> = {};
  for (const [entity, info] of entries) {
    values[entity] = info.total;
    tips[entity] = (
      <div className="space-y-1">
        <div className="font-semibold">Pontos de desafios: {fmtPts(info.total)}</div>
        {info.items.map((it, i) => (
          <div key={i} className="text-xs">
            • {it.name}
            <span className="text-muted-foreground"> · +{fmtPts(it.bonus)}</span>
            {it.years.length > 0 && (
              <span className="text-muted-foreground"> · {it.years.join(", ")}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return { key: "desafios", label: "Desafios", values, tips };
}
