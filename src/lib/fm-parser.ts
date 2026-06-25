import * as XLSX from "xlsx";

export type Severity = "green" | "yellow" | "red";

export interface ValidationMessage {
  level: Severity;
  text: string;
}

export interface ParsedStanding {
  module: "superleague" | "national";
  division_label: string | null;
  division_num: number | null;
  position: number | null;
  info: string | null;
  club_name: string;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  points: number | null;
  is_champion: boolean;
}

export interface ParsedCoach {
  module: "superleague" | "national";
  name: string;
  nationality: string | null;
  club_name: string | null;
  info: string | null;
}

export interface ParsedContinental {
  competition: string;
  team1: string | null;
  team2: string | null;
  result: string | null;
  winner: string | null;
  sf1: string | null;
  sf2: string | null;
  qf1: string | null;
  qf2: string | null;
  qf3: string | null;
  qf4: string | null;
}

export interface ParsedInternational {
  competition: string;
  team1: string | null;
  team2: string | null;
  coach1: string | null;
  coach2: string | null;
  result: string | null;
  winner: string | null;
  sf1: string | null;
  sf1_coach: string | null;
  sf2: string | null;
  sf2_coach: string | null;
  qf1: string | null;
  qf1_coach: string | null;
  qf2: string | null;
  qf2_coach: string | null;
  qf3: string | null;
  qf3_coach: string | null;
  qf4: string | null;
  qf4_coach: string | null;
}

export interface ParsedPlayer {
  idu: string | null;
  name: string;
  league: string | null;
  club_name: string | null;
  age: number | null;
  gls: number;
  ast: number;
  salary: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  vp: number;
  info: string | null;
  rec: string | null;
}

export interface ParsedData {
  teamCountry: { club: string; country: string | null }[];
  divisionWeights: { division_num: number; weight: number }[];
  standings: ParsedStanding[];
  coaches: ParsedCoach[];
  continental: ParsedContinental[];
  international: ParsedInternational[];
  players: ParsedPlayer[];
}

export interface ParseResult {
  kind: "superleague" | "national";
  data: ParsedData;
  messages: ValidationMessage[];
  blocked: boolean;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function findCol(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const n = norm(cand);
    const hit = keys.find((k) => norm(k) === n);
    if (hit) return hit;
  }
  // partial match
  for (const cand of candidates) {
    const n = norm(cand);
    const hit = keys.find((k) => norm(k).includes(n));
    if (hit) return hit;
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function num0(v: unknown): number {
  const n = toNum(v);
  return n == null ? 0 : n;
}

function parseSalario(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/€/g, "").replace(/p\/?\s*a/gi, "").replace(/\s/g, "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseVP(v: unknown): number {
  if (v === null || v === undefined) return 0;
  let s = String(v).replace(/€/g, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  let mult = 1;
  if (s.endsWith("M")) { mult = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith("m") || s.endsWith("k") || s.endsWith("K")) { mult = 1_000; s = s.slice(0, -1); }
  s = s.replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * mult : 0;
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] | null {
  const target = wb.SheetNames.find((s) => norm(s) === norm(name));
  if (!target) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[target], { defval: null });
}

function parseScore(result: string | null, t1: string | null, t2: string | null): string | null {
  if (!result) return null;
  const m = String(result).match(/(\d+)\s*[-:xX]\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === b) return null;
  return a > b ? t1 : t2;
}

/** Detect whether a workbook is the SuperLeague file or the National leagues file. */
export function detectKind(wb: XLSX.WorkBook): "superleague" | "national" {
  const names = wb.SheetNames.map(norm);
  if (names.some((n) => n.includes("equipas_pais") || n.includes("pesos_fixos"))) return "superleague";
  if (names.some((n) => n.includes("ligas nacionais") || n.includes("continenta"))) return "national";
  // fall back: ranking sheet => superleague
  if (names.some((n) => n === "ranking")) return "superleague";
  return "national";
}

export function parseWorkbook(buffer: ArrayBuffer, filename = ""): ParseResult {
  const messages: ValidationMessage[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    return {
      kind: "national",
      data: { teamCountry: [], divisionWeights: [], standings: [], coaches: [], continental: [], international: [], players: [] },
      messages: [{ level: "red", text: "✖ Ficheiro corrompido ou ilegível" }],
      blocked: true,
    };
  }

  const kind = detectKind(wb);
  const data: ParsedData = {
    teamCountry: [],
    divisionWeights: [],
    standings: [],
    coaches: [],
    continental: [], international: [],
    players: [],
  };

  // --- Equipas_Pais (superleague) ---
  const ep = sheetRows(wb, "Equipas_Pais");
  if (ep && ep.length) {
    const clubCol = findCol(ep[0], ["Clube", "Equipa"]);
    const countryCol = findCol(ep[0], ["Pais", "País", "Country"]);
    if (clubCol) {
      for (const r of ep) {
        const club = String(r[clubCol] ?? "").trim();
        if (!club) continue;
        data.teamCountry.push({ club, country: countryCol ? (String(r[countryCol] ?? "").trim() || null) : null });
      }
    }
  }

  // --- Pesos_Fixos (superleague division weights) ---
  const pf = sheetRows(wb, "Pesos_Fixos");
  if (pf && pf.length) {
    const divCol = findCol(pf[0], ["Divisao", "Divisão"]);
    const wCol = findCol(pf[0], ["Peso", "Weight"]);
    if (divCol && wCol) {
      for (const r of pf) {
        const d = toNum(r[divCol]);
        const w = toNum(r[wCol]);
        if (d != null && w != null) data.divisionWeights.push({ division_num: d, weight: w });
      }
    }
  } else if (kind === "superleague") {
    messages.push({ level: "yellow", text: "⚠ Folha 'Pesos_Fixos' não encontrada — serão usados pesos padrão" });
  }

  // --- Ranking (superleague standings) ---
  if (kind === "superleague") {
    const rk = sheetRows(wb, "Ranking");
    if (!rk || !rk.length) {
      messages.push({ level: "red", text: "✖ Folha obrigatória 'Ranking' inexistente ou vazia" });
    } else {
      parseStandings(rk, "superleague", data, messages);
    }
  }

  // --- Ligas Nacionais (national standings) ---
  if (kind === "national") {
    const ln = sheetRows(wb, "Ligas Nacionais");
    if (!ln || !ln.length) {
      messages.push({ level: "red", text: "✖ Folha obrigatória 'Ligas Nacionais' inexistente ou vazia" });
    } else {
      parseStandings(ln, "national", data, messages);
    }

    // --- Compts Continentais ---
    const cc = sheetRows(wb, "Compts Continentais");
    if (cc && cc.length) {
      const compCol = findCol(cc[0], ["Competição", "Competicao", "Competition"]);
      const t1Col = findCol(cc[0], ["Equipa 1", "Equipa1"]);
      const t2Col = findCol(cc[0], ["Equipa 2", "Equipa2"]);
      const resCol = findCol(cc[0], ["Resultado", "Result"]);
      const sf1Col = findCol(cc[0], ["Meia Final Equipa 1", "Meia-Final Equipa 1", "Meias Finais Equipa 1", "Semi Final Equipa 1", "SF Equipa 1", "MF Equipa 1"]);
      const sf2Col = findCol(cc[0], ["Meia Final Equipa 2", "Meia-Final Equipa 2", "Meias Finais Equipa 2", "Semi Final Equipa 2", "SF Equipa 2", "MF Equipa 2"]);
      const qf1Col = findCol(cc[0], ["Quartos de Final Equipa 1", "Quartos Final Equipa 1", "QF Equipa 1"]);
      const qf2Col = findCol(cc[0], ["Quartos de Final Equipa 2", "Quartos Final Equipa 2", "QF Equipa 2"]);
      const qf3Col = findCol(cc[0], ["Quartos de Final Equipa 3", "Quartos Final Equipa 3", "QF Equipa 3"]);
      const qf4Col = findCol(cc[0], ["Quartos de Final Equipa 4", "Quartos Final Equipa 4", "QF Equipa 4"]);
      const pick = (r: Record<string, unknown>, col: string | null): string | null =>
        col ? (String(r[col] ?? "").trim() || null) : null;
      if (compCol) {
        for (const r of cc) {
          const competition = String(r[compCol] ?? "").trim();
          if (!competition) continue;
          const team1 = pick(r, t1Col);
          const team2 = pick(r, t2Col);
          const result = pick(r, resCol);
          data.continental.push({
            competition, team1, team2, result,
            winner: parseScore(result, team1, team2),
            sf1: pick(r, sf1Col),
            sf2: pick(r, sf2Col),
            qf1: pick(r, qf1Col),
            qf2: pick(r, qf2Col),
            qf3: pick(r, qf3Col),
            qf4: pick(r, qf4Col),
          });
        }
      }
    }

    // --- Compts Seleções (international national-team competitions) ---
    // Match any sheet whose normalised name contains "sele" (Seleções/Selecoes/Selecções/Selecções…)
    const ciName = wb.SheetNames.find((s) => {
      const n = norm(s);
      return n.includes("sele") && (n.includes("compt") || n.includes("comp") || n.includes("internac"));
    });
    const ci = ciName ? sheetRows(wb, ciName) : null;
    if (ci && ci.length) {
      const compCol = findCol(ci[0], ["Competição", "Competicao", "Competition"]);
      const t1Col = findCol(ci[0], ["Equipa 1", "Equipa1", "Seleção 1", "Selecao 1"]);
      const c1Col = findCol(ci[0], ["Treinador 1", "Treinador1", "Coach 1"]);
      const resCol = findCol(ci[0], ["Resultado", "Result"]);
      const t2Col = findCol(ci[0], ["Equipa 2", "Equipa2", "Seleção 2", "Selecao 2"]);
      const c2Col = findCol(ci[0], ["Treinador 2", "Treinador2", "Coach 2"]);
      const sf1Col = findCol(ci[0], ["Meia Final Equipa 1", "Meia-Final Equipa 1", "Meias Finais Equipa 1", "Semi Final Equipa 1", "SF Equipa 1", "MF Equipa 1"]);
      const sf1CoachCol = findCol(ci[0], ["Treinador Meia Final 1", "Treinador MF 1", "Treinador SF 1", "Treinador Meia-Final 1", "Coach Meia Final 1"]);
      const sf2Col = findCol(ci[0], ["Meia Final Equipa 2", "Meia-Final Equipa 2", "Meias Finais Equipa 2", "Semi Final Equipa 2", "SF Equipa 2", "MF Equipa 2"]);
      const sf2CoachCol = findCol(ci[0], ["Treinador Meia Final 2", "Treinador MF 2", "Treinador SF 2", "Treinador Meia-Final 2", "Coach Meia Final 2"]);
      const qf1Col = findCol(ci[0], ["Quartos de Final Equipa 1", "Quartos Final Equipa 1", "QF Equipa 1"]);
      const qf1CoachCol = findCol(ci[0], ["Quartos de Final Treinador 1", "Treinador Quartos de Final 1", "Treinador QF 1", "Quartos Final Treinador 1"]);
      const qf2Col = findCol(ci[0], ["Quartos de Final Equipa 2", "Quartos Final Equipa 2", "QF Equipa 2"]);
      const qf2CoachCol = findCol(ci[0], ["Quartos de Final Treinador 2", "Treinador Quartos de Final 2", "Treinador QF 2", "Quartos Final Treinador 2"]);
      const qf3Col = findCol(ci[0], ["Quartos de Final Equipa 3", "Quartos Final Equipa 3", "QF Equipa 3"]);
      const qf3CoachCol = findCol(ci[0], ["Quartos de Final Treinador 3", "Treinador Quartos de Final 3", "Treinador QF 3", "Quartos Final Treinador 3"]);
      const qf4Col = findCol(ci[0], ["Quartos de Final Equipa 4", "Quartos Final Equipa 4", "QF Equipa 4"]);
      const qf4CoachCol = findCol(ci[0], ["Quartos de Final Treinador 4", "Treinador Quartos de Final 4", "Treinador QF 4", "Quartos Final Treinador 4"]);
      const pickI = (r: Record<string, unknown>, col: string | null): string | null =>
        col ? (String(r[col] ?? "").trim() || null) : null;
      if (compCol) {
        for (const r of ci) {
          const competition = String(r[compCol] ?? "").trim();
          if (!competition) continue;
          const team1 = pickI(r, t1Col);
          const team2 = pickI(r, t2Col);
          const coach1 = pickI(r, c1Col);
          const coach2 = pickI(r, c2Col);
          const result = pickI(r, resCol);
          data.international.push({
            competition,
            team1,
            team2,
            coach1,
            coach2,
            result,
            winner: parseScore(result, team1, team2),
            sf1: pickI(r, sf1Col),
            sf1_coach: pickI(r, sf1CoachCol),
            sf2: pickI(r, sf2Col),
            sf2_coach: pickI(r, sf2CoachCol),
            qf1: pickI(r, qf1Col),
            qf1_coach: pickI(r, qf1CoachCol),
            qf2: pickI(r, qf2Col),
            qf2_coach: pickI(r, qf2CoachCol),
            qf3: pickI(r, qf3Col),
            qf3_coach: pickI(r, qf3CoachCol),
            qf4: pickI(r, qf4Col),
            qf4_coach: pickI(r, qf4CoachCol),
          });
        }
      }
    } else if (ciName) {
      messages.push({ level: "yellow", text: `⚠ Folha '${ciName}' encontrada, mas sem linhas de jogos para importar` });
    } else {
      messages.push({ level: "yellow", text: "⚠ Folha 'Compts Seleções' não encontrada — competições internacionais ficam vazias" });
    }
  }


  // --- Treinadores ---
  const tr = sheetRows(wb, "Treinadores");
  if (tr && tr.length) {
    const nameCol = findCol(tr[0], ["Nome", "Name"]);
    const nacCol = findCol(tr[0], ["Nac", "Nacionalidade"]);
    const clubCol = findCol(tr[0], ["Clube", "Equipa"]);
    const infCol = findCol(tr[0], ["Inf", "Info"]);
    if (nameCol) {
      for (const r of tr) {
        const name = String(r[nameCol] ?? "").trim();
        if (!name || name.startsWith("http")) continue;
        data.coaches.push({
          module: kind === "superleague" ? "superleague" : "national",
          name,
          nationality: nacCol ? (String(r[nacCol] ?? "").trim() || null) : null,
          club_name: clubCol ? (String(r[clubCol] ?? "").trim() || null) : null,
          info: infCol ? (String(r[infCol] ?? "").trim() || null) : null,
        });
      }
    }
  } else {
    messages.push({ level: "yellow", text: "⚠ Folha 'Treinadores' não encontrada — clubes ficam sem treinador associado" });
  }

  // --- Jogadores (superleague + national) ---
  {
    const jg = sheetRows(wb, "Jogadores");
    if (jg && jg.length) {
      const nameCol = findCol(jg[0], ["Nome", "Name"]);
      const iduCol = findCol(jg[0], ["IDU", "UID"]);
      const ligaCol = findCol(jg[0], ["Liga", "League"]);
      const clubCol = findCol(jg[0], ["Clube", "Equipa"]);
      const ageCol = findCol(jg[0], ["Idade", "Age"]);
      const glsCol = findCol(jg[0], ["Gls", "Golos"]);
      const astCol = findCol(jg[0], ["Ast", "Assist"]);
      const salCol = findCol(jg[0], ["Salário", "Salario", "Salary"]);
      const raCol = findCol(jg[0], ["R.A.", "RA"]);
      const rmCol = findCol(jg[0], ["R.M.", "RM"]);
      const caCol = findCol(jg[0], ["C.A.", "CA"]);
      const cpCol = findCol(jg[0], ["C.P.", "CP"]);
      const vpCol = findCol(jg[0], ["VP", "Valor"]);
      const infCol = findCol(jg[0], ["Inf", "Info"]);
      const recCol = findCol(jg[0], ["Rec"]);
      if (nameCol) {
        for (const r of jg) {
          const name = String(r[nameCol] ?? "").trim();
          if (!name || name.startsWith("http")) continue;
          data.players.push({
            idu: iduCol ? (String(r[iduCol] ?? "").trim() || null) : null,
            name,
            league: ligaCol ? (String(r[ligaCol] ?? "").trim() || null) : null,
            club_name: clubCol ? (String(r[clubCol] ?? "").trim() || null) : null,
            age: ageCol ? toNum(r[ageCol]) : null,
            gls: glsCol ? num0(r[glsCol]) : 0,
            ast: astCol ? num0(r[astCol]) : 0,
            salary: salCol ? parseSalario(r[salCol]) : 0,
            ra: raCol ? num0(r[raCol]) : 0,
            rm: rmCol ? num0(r[rmCol]) : 0,
            ca: caCol ? num0(r[caCol]) : 0,
            cp: cpCol ? num0(r[cpCol]) : 0,
            vp: vpCol ? parseVP(r[vpCol]) : 0,
            info: infCol ? (String(r[infCol] ?? "").trim() || null) : null,
            rec: recCol ? (String(r[recCol] ?? "").trim() || null) : null,
          });
        }
      }
    } else {
      messages.push({ level: "yellow", text: "⚠ Folha 'Jogadores' não encontrada — páginas de jogadores ficam vazias para esta época" });
    }
  }

  const blocked = messages.some((m) => m.level === "red");
  if (!blocked) {
    messages.unshift({ level: "green", text: "✓ Dados validados com sucesso" });
  }
  return { kind, data, messages, blocked };
}

function parseStandings(
  rows: Record<string, unknown>[],
  module: "superleague" | "national",
  data: ParsedData,
  messages: ValidationMessage[],
) {
  const first = rows[0];
  const teamCol = findCol(first, ["Equipa", "Clube", "Team"]);
  const posCol = findCol(first, ["Pos", "Posição", "Posicao"]);
  const ptsCol = findCol(first, ["Pts", "Pontos", "Points"]);
  const divCol = findCol(first, ["Divisao", "Divisão", "Liga"]);
  const infCol = findCol(first, ["Inf", "Info"]);
  const jCol = findCol(first, ["J", "Jogos"]);
  const vCol = findCol(first, ["Vitória", "Vitoria", "V"]);
  const eCol = findCol(first, ["E", "Empates"]);
  const dCol = findCol(first, ["D", "Derrotas"]);
  const gmCol = findCol(first, ["GM"]);
  const gsCol = findCol(first, ["GS"]);
  const dgCol = findCol(first, ["DG"]);

  if (!teamCol) messages.push({ level: "red", text: "✖ Coluna 'Equipa' não encontrada" });
  if (!posCol) messages.push({ level: "red", text: "✖ Coluna 'Posição' não encontrada" });
  if (!ptsCol) messages.push({ level: "red", text: "✖ Coluna 'Pontos' não encontrada" });
  if (!teamCol || !posCol || !ptsCol) return;

  let count = 0;
  for (const r of rows) {
    const club_name = String(r[teamCol] ?? "").trim();
    if (!club_name) continue;
    const info = infCol ? (String(r[infCol] ?? "").trim() || null) : null;
    const divRaw = divCol ? r[divCol] : null;
    const division_num = module === "superleague" ? toNum(divRaw) : null;
    const division_label = divRaw != null ? String(divRaw).trim() : null;
    data.standings.push({
      module,
      division_label,
      division_num,
      position: toNum(r[posCol]),
      info,
      club_name,
      played: jCol ? toNum(r[jCol]) : null,
      wins: vCol ? toNum(r[vCol]) : null,
      draws: eCol ? toNum(r[eCol]) : null,
      losses: dCol ? toNum(r[dCol]) : null,
      gf: gmCol ? toNum(r[gmCol]) : null,
      ga: gsCol ? toNum(r[gsCol]) : null,
      gd: dgCol ? toNum(r[dgCol]) : null,
      points: toNum(r[ptsCol]),
      // Champion = row flagged with "C" in Info, NOT necessarily position 1
      is_champion: norm(info) === "c",
    });
    count++;
  }
  if (count === 0) messages.push({ level: "red", text: "✖ Não existem classificações na folha" });
}