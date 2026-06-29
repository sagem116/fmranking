import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Globe2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import { buildCountryProfile } from "@/lib/fm-profiles";
import { EvolutionChart } from "@/components/EvolutionChart";
import { DesafiosProfileCard } from "@/components/DesafiosProfileCard";
import { fmtPts } from "@/lib/fmt";
import { CountryRecordsSection } from "@/components/RecordsSection";

export const Route = createFileRoute("/paises/$name")({
  component: CountryProfilePage,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function CountryProfilePage() {
  const { name } = Route.useParams();
  const { data, isLoading } = useRankings();
  const profile = useMemo(() => (data ? buildCountryProfile(data.data, name, data.config) : null), [data, name]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="space-y-4">
        <Link to="/paises" className="text-sm text-primary inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Países</Link>
        <p className="text-muted-foreground">País não encontrado: {name}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/paises" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Todos os países
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Globe2 className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pontos brutos" value={fmtPts(profile.totalRaw)} />
        <Stat label="Títulos" value={profile.titles} />
        <Stat label="Clubes" value={profile.clubs.length} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução histórica bruta</CardTitle></CardHeader>
        <CardContent><EvolutionChart data={profile.chart} showModeToggle={false} mode="raw" /></CardContent>
      </Card>

      <DesafiosProfileCard results={data?.desafioResults} subject="countries" entity={profile.name} />

      <CountryRecordsSection countryName={profile.name} clubCountry={data!.data.clubCountry} />

      <Card>
        <CardHeader><CardTitle className="text-base">Clubes contribuintes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Clube</th>
                <th className="text-right p-3">Títulos</th>
                <th className="text-right p-3">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {profile.clubs.map((c, i) => (
                <tr key={c.name} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-medium">
                    <Link to="/clubes/$name" params={{ name: c.name }} className="hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.titles}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{fmtPts(c.raw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
