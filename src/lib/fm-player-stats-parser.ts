import * as XLSX from "xlsx";

export type CompType = "superleague" | "national" | "continental" | "international";

export interface PlayerStatRow {
  season_year: number;
  comp_type: CompType;
  competition: string;
  country: string | null;
  continent: string | null;
  player_name: string;
  idu: string | null;
  nationality: string | null;
  club: string | null;
  gls: number;
  ast: number;
  games: number;
  hdj: number;
  ca: number;
  cp: number;
  vp: number;
  salary: number;
  ra: number;
  rm: number;
  rc: number;
  age: number;
}

export interface PlayerStatsParseResult {
  rows: PlayerStatRow[];
  bySheet: Record<string, { sheet: string; comp_type: CompType; count: number }>;
  skippedSheets: string[];
}

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s._-]+/g, "")
    .trim();
}

function sheetType(name: string): CompType | null {
  const n = norm(name);
  if (!n) return null;
  if (n.includes("internac")) return "international";
  if (n.includes("continent")) return "continental";
  if (n.includes("nacional") || n.includes("ligas")) return "national";
  if (n.includes("divisao") || n.includes("superleague") || n === "div") return "superleague";
  return null;
}

const HEADER_ALIASES: Record<string, string[]> = {
  divisao: ["divisao", "divisão", "liga", "competicao", "competição", "comp"],
  pais: ["pais", "país", "country"],
  nome: ["nome", "name", "jogador", "player"],
  idu: ["idu", "uid", "id"],
  nac: ["nac", "nacionalidade", "nationality"],
  clube: ["clube", "club", "equipa", "team"],
  gls: ["gls", "golos", "goals", "g"],
  ast: ["ast", "assistencias", "assistências", "assists", "a"],
  jogos: ["jogos", "games", "j", "matches", "apps"],
  hdj: ["hdj", "homemdojogo", "mvp", "manofthematch", "motm"],
  ca: ["ca", "currentability"],
  cp: ["cp", "potentialability", "potencial"],
  vp: ["vp", "valordepasse", "valor", "value"],
  salario: ["salario", "salário", "salary", "wage"],
  ra: ["ra", "ratingatual"],
  rm: ["rm", "ratingmedio", "ratingmédio"],
  rc: ["rc", "ratingcomp"],
  idade: ["idade", "age"],
};

function buildHeaderMap(headers: unknown[]): Record<string, number> {
  const normed = headers.map((h) => norm(h));
  const out: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const a = aliases.map(norm);
    for (let i = 0; i < normed.length; i++) {
      if (a.includes(normed[i])) {
        out[key] = i;
        break;
      }
    }
  }
  return out;
}

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const CONTINENT_MAP: { match: RegExp; cont: string }[] = [
  { match: /uefa|europa|champions|europa\s*league|conference\s*league/i, cont: "Europa" },
  { match: /libertadores|sudamericana|sul[-\s]?americ/i, cont: "América do Sul" },
  { match: /concacaf|north\s*american|norte\s*americ/i, cont: "América do Norte" },
  { match: /afc|asian|asia|asiat/i, cont: "Ásia" },
  { match: /caf|african|africa|afric/i, cont: "África" },
  { match: /ofc|oceania|oceân/i, cont: "Oceânia" },
];

function continentFromCompetition(name: string): string | null {
  for (const { match, cont } of CONTINENT_MAP) if (match.test(name)) return cont;
  return null;
}

export function parsePlayerStatsWorkbook(buffer: ArrayBuffer, seasonYear: number): PlayerStatsParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const rows: PlayerStatRow[] = [];
  const bySheet: Record<string, { sheet: string; comp_type: CompType; count: number }> = {};
  const skippedSheets: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const comp_type = sheetType(sheetName);
    if (!comp_type) {
      skippedSheets.push(sheetName);
      continue;
    }
    const sheet = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (!matrix.length) continue;
    const headers = (matrix[0] ?? []) as unknown[];
    const idx = buildHeaderMap(headers);
    if (idx.nome == null) {
      skippedSheets.push(`${sheetName} (sem coluna Nome)`);
      continue;
    }
    let count = 0;
    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r] as unknown[];
      if (!row || row.every((c) => c == null || c === "")) continue;
      const name = str(row[idx.nome]);
      if (!name) continue;
      const divRaw = idx.divisao != null ? row[idx.divisao] : "";
      let competition: string;
      if (comp_type === "superleague") {
        const n = num(divRaw);
        competition = n > 0 ? `Super League D${n}` : (str(divRaw) ?? "Super League");
      } else {
        competition = str(divRaw) ?? "—";
      }
      const country = idx.pais != null ? str(row[idx.pais]) : null;
      const continent = comp_type === "continental" ? continentFromCompetition(competition) : null;
      rows.push({
        season_year: seasonYear,
        comp_type,
        competition,
        country,
        continent,
        player_name: name,
        idu: idx.idu != null ? str(row[idx.idu]) : null,
        nationality: idx.nac != null ? str(row[idx.nac]) : null,
        club: idx.clube != null ? str(row[idx.clube]) : null,
        gls: num(row[idx.gls]),
        ast: num(row[idx.ast]),
        games: num(row[idx.jogos]),
        hdj: num(row[idx.hdj]),
        ca: num(row[idx.ca]),
        cp: num(row[idx.cp]),
        vp: num(row[idx.vp]),
        salary: num(row[idx.salario]),
        ra: num(row[idx.ra]),
        rm: num(row[idx.rm]),
        rc: num(row[idx.rc]),
        age: num(row[idx.idade]),
      });
      count++;
    }
    bySheet[sheetName] = { sheet: sheetName, comp_type, count };
  }

  const seen = new Map<string, number>();
  const out: PlayerStatRow[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const key = r.idu
      ? `${r.comp_type}|idu:${r.idu}`
      : `${r.comp_type}|nc:${r.player_name}|${r.club ?? ""}|${r.competition}`;
    if (seen.has(key)) continue;
    seen.set(key, i);
    out.unshift(r);
  }
  return { rows: out, bySheet, skippedSheets };
}
