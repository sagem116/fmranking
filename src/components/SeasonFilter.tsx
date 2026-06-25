import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  value: "total" | number;
  onChange: (v: "total" | number) => void;
  years: number[];
  totalLabel?: string;
  className?: string;
}

export function SeasonFilter({ value, onChange, years, totalLabel = "Total (todas as épocas)", className }: Props) {
  const v = value === "total" ? "total" : String(value);
  return (
    <Select value={v} onValueChange={(s) => onChange(s === "total" ? "total" : Number(s))}>
      <SelectTrigger className={className ?? "w-[220px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="total">{totalLabel}</SelectItem>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>Época {y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
