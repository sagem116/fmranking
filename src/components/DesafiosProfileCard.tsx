import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target } from "lucide-react";
import { buildDesafioBreakdownBySubject, type DesafioResult, type Subject } from "@/lib/fm-desafios";
import { fmtPts } from "@/lib/fmt";

export function DesafiosProfileCard({
  results,
  subject,
  entity,
}: {
  results: DesafioResult[] | undefined;
  subject: Subject;
  entity: string;
}) {
  const breakdown = buildDesafioBreakdownBySubject(results ?? [], subject);
  const info = breakdown[entity];
  const items = info?.items ?? [];
  const total = info?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4 text-gold" /> Desafios conquistados
          <Badge variant="outline" className="ml-2">{items.length}</Badge>
          {total > 0 && (
            <Badge variant="secondary" className="ml-1">+{fmtPts(total)} pts</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não conquistou nenhum desafio. Defina ou ative desafios em <span className="font-medium">Desafios</span>.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desafio</TableHead>
                <TableHead>Épocas</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items
                .slice()
                .sort((a, b) => b.bonus - a.bonus)
                .map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {it.years.length ? it.years.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      +{fmtPts(it.bonus)}
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow>
                <TableCell colSpan={2} className="text-right text-sm text-muted-foreground">Total</TableCell>
                <TableCell className="text-right tabular-nums font-bold">+{fmtPts(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
