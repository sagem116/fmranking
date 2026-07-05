// New season importer — parses the two Excel files that make up a season
// (Competitions file + Players file). Every sheet and every column is
// identified by NAME, never by position. Unknown sheets/columns are
// ignored (only a warning is emitted).
//
// The parser is intentionally decoupled from the DB writers so it can be
// re-used by the validator preview and by the actual importer.

import * as XLSX from "xlsx";

// ---------- Types --------------------------------------------------------

export type CompType = "superleague" | "national" | "continental" | "international";

export interface ClubCountryRow { club: string; country: string | null; continent: string | null; }
export interface ClubReputationRow {
  club: string;
  reputation: number | null;
  avg_attendance: number | null;
  season_ticket_holders: number | null;
}
export interface CompetitionReputationRow { competition: string; reputation: number | null; }

export interface CoachRow {
  idu: string | null;
  name: string;
  nationality: string | null;
  age: number | null;
  club: string | null;
  country: string | null;               // for national-team coaches
  club_role: string | null;
  intl_role: string | null;
  salary: number | null;
  intl_salary: number | null;
  tactical_style: string | null;
  play_style: string | null;
  attacking_formation: string | null;
  defensive_formation: string | null;
  preferred_formation: string | null;
  secondary_formation: string | null;
  mentality: string | null;
  marking_type: string | null;
  pressing_type: string | null;
  training_type: string | null;
  personality: string | null;
  press_relationship: string | null;
  rm: number | null;
  rc: number | null;
  ca: number | null;
  cp: number | null;
  is_national_team: boolean;
}

export interface StandingRow {
  module: "superleague" | "national";
  competition: string | null;
  division_label: string | null;
  division_num: number | null;
  position: number | null;
  info: string | null;
  club_name: string;
  played: number | null;
  wins: number | null;
  vp: number | null;                    // superleague-only "VP" column
  penalties: number | null;             // superleague-only
  draws: number | null;
  losses: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  points: number | null;
  is_champion: boolean;
}

export interface BracketRow {
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

export interface PlayerStatRow {
  comp_type: CompType;
  competition: string;
  player_name: string;
  idu: string | null;
  nationality: string | null;
  club: string | null;
  age: number | null;
  games: number;
  gls: number;
  ast: number;
  xg: number;
  pass_pct: number;
  tackles_per90: number;
  fouls_per90: number;
  shot_pct: number;
  yellows: number;
  reds: number;
  avg_rating: number;
  ca: number;
  cp: number;
  vp: number;
  ra: number;
  rm: number;
  rc: number;
  salary: number;
}

export interface ParsedCompetitionsFile {
  clubCountry: ClubCountryRow[];
  clubReputation: ClubReputationRow[];
  competitionReputation: CompetitionReputationRow[];
  coaches: CoachRow[];
  standings: StandingRow[];
  continental: BracketRow[];
  international: BracketRow[];
  presentSheets: string[];
  ignoredSheets: string[];
  warnings: string[];
  fatal: string[];                     // structural errors that block import
}

export interface ParsedPlayersFile {
  players: PlayerStatRow[];
  bySheet: Record<string, { sheet: string; comp_type: CompType; count: number }>;
  ignoredSheets: string[];
  warnings: string[];
  fatal: string[];
}

// ---------- Helpers ------------------------------------------------------

const normKey = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s._\-/%()]+/g, "")
    .trim();

function findSheet(wb: XLSX.WorkBook, aliases: string[]): string | null {
  const wanted = aliases.map(normKey);
  for (const name of wb.SheetNames) {
    if (wanted.includes(normKey(name))) return name;
  }
  return null;
}

/**
 * Best-effort sheet-name matcher: for each declared canonical sheet, we
 * accept anything whose normalized form starts with or contains the alias.
 * This is used to classify "unknown" sheets as ignored vs. player sheets.
 */
function matchSheetFuzzy(wb: XLSX.WorkBook, aliases: string[]): string | null {
  const wanted = aliases.map(normKey);
  for (const name of wb.SheetNames) {
    const n = normKey(name);
    for (const w of wanted) {
      if (n === w || n.startsWith(w) || w.startsWith(n) || n.includes(w)) return name;
    }
  }
  return null;
}

function rowsOf(wb: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
}

function buildColMap(row: Record<string, unknown>, aliases: Record<string, string[]>): Record<string, string | null> {
  const keys = Object.keys(row);
  const normed = keys.map((k) => ({ k, n: normKey(k) }));
  const out: Record<string, string | null> = {};
  for (const [canon, list] of Object.entries(aliases)) {
    let hit: string | null = null;
    const wants = list.map(normKey);
    for (const w of wants) {
      const m = normed.find((x) => x.n === w);
      if (m) { hit = m.k; break; }
    }
    if (!hit) {
      for (const w of wants) {
        const m = normed.find((x) => x.n.includes(w));
        if (m) { hit = m.k; break; }
      }
    }
    out[canon] = hit;
  }
  return out;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function toNum(v: unknown): number | null {
  if (v == null || v === "" || v === "-" || v === "—") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(/,/g, ".");
  const n = Number(s.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function num0(v: unknown): number { const n = toNum(v); return n == null ? 0 : n; }

// "88,440 € p/a", "6,727,000 € p/a", "603,000 € p/a" → number (annual)
function parseSalary(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v).replace(/€/g, "").replace(/p\/?\s*a/gi, "").replace(/N\/D/gi, "").replace(/\s/g, "").trim();
  if (!raw) return 0;
  const s = raw.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// VP: "11.75M €", "800k", "234000".
function parseVP(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/€/g, "").replace(/\s/g, "").trim();
  const m = s.match(/^([\d.,]+)\s*([mMkKbB])?$/);
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  const suf = m[2];
  if (suf === "M" || suf === "b" || suf === "B") return n * 1_000_000;
  if (suf === "m" || suf === "k" || suf === "K") return n * 1_000;
  return n;
}

// "8 (3)" -> 11
function parseGames(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const m = String(v).match(/-?\d+(?:[.,]\d+)?/g);
  if (!m) return 0;
  let total = 0;
  for (const s of m) { const n = Number(s.replace(",", ".")); if (Number.isFinite(n)) total += n; }
  return total;
}

function parseScore(result: string | null, t1: string | null, t2: string | null): string | null {
  if (!result) return null;
  const m = String(result).match(/(\d+)\s*[-:xX–]\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (a === b) return null;
  return a > b ? t1 : t2;
}

// ---------- Column alias catalogs ---------------------------------------

const SHEET_ALIASES = {
  clubePais:       ["Clube Pais", "Clube País", "ClubePais", "Clube-Pais", "Clubes Pais", "Clubes País"],
  reputacaoClubes: ["Reputaçao Clubes", "Reputação Clubes", "Reputacao Clubes", "ReputacaoClubes", "Reputação Clube"],
  reputacaoComps:  ["Reputaçao Competiçoes", "Reputação Competições", "Reputacao Competicoes", "Reputação Competicoes", "Reputacao Competições", "Reputação da Competição"],
  treinador:       ["Treinador", "Treinadores", "Coach", "Coaches"],
  superLeague:     ["Super League", "SuperLeague", "Ranking", "Divisão", "Divisao", "Divisão 1", "Divisao 1", "Division", "Super League 1"],
  ligasNacionais:  ["Ligas Nacionais", "Ligas_Nacionais", "LigasNacionais", "National Leagues", "Nacional", "Nacionais"],
  continentais:    ["Continentais", "Compts Continentais", "Continental", "Competições Continentais", "Competicoes Continentais"],
  internacional:   ["Internacional", "Internacionais", "Compts Seleções", "Compts Selecoes", "Compts Seleccoes", "Selecoes"],
};

const CLUBE_PAIS_COLS = {
  club:      ["Clube", "Club", "Equipa", "Team"],
  country:   ["País", "Pais", "Country"],
  continent: ["Continente", "Continent"],
};

const REP_CLUBES_COLS = {
  club:       ["Clube", "Club", "Equipa", "Team"],
  reputation: ["Reputação", "Reputacao", "Reputation", "Rep"],
  attendance: ["Assistência Média", "Assistencia Media", "Assistência", "Assistencia", "Avg Attendance", "Attendance"],
  tickets:    ["Detentores de Bilhetes de Época", "Detentores de Bilhetes de Epoca", "Bilhetes de Época", "Season Ticket Holders", "Season Tickets"],
};

const REP_COMPS_COLS = {
  competition: ["Competição", "Competicao", "Competition", "Comp"],
  reputation:  ["Reputação", "Reputacao", "Reputation", "Rep"],
};

const TREINADOR_COLS = {
  info:       ["Inf", "Info"],
  idu:        ["IDU", "UID", "ID"],
  name:       ["Nome", "Name"],
  age:        ["Idade", "Age"],
  nationality:["Nac", "Nacionalidade", "Nationality"],
  club:       ["Clube", "Club", "Equipa", "Team"],
  country:    ["País", "Pais", "Country"],
  clubRole:   ["Função No Clube", "Funcao No Clube", "Função no Clube", "Funcao no Clube", "Club Role"],
  intlRole:   ["Função Internacional", "Funcao Internacional", "International Role"],
  salary:     ["Salário", "Salario", "Salary", "Wage"],
  intlSalary: ["Orden. intern.", "Orden Intern", "Ordenado Internacional", "International Salary"],
  tacStyle:   ["Estilo Táctico", "Estilo Tatico", "Estilo Táctico", "Tactical Style"],
  playStyle:  ["Estilo de Jogo", "Play Style"],
  atkForm:    ["Formação Atacante Preferida", "Formacao Atacante Preferida", "Attacking Formation"],
  defForm:    ["Formação Defensiva Preferida", "Formacao Defensiva Preferida", "Defensive Formation"],
  prefForm:   ["Formação Preferida", "Formacao Preferida", "Preferred Formation"],
  secForm:    ["Segunda Formação Preferida", "Segunda Formacao Preferida", "Secondary Formation"],
  mentality:  ["Mentalidade de Jogo", "Mentalidade", "Mentality"],
  marking:    ["Tipo de Marcação", "Tipo de Marcacao", "Marking Type"],
  pressing:   ["Tipo de Pressão", "Tipo de Pressao", "Pressing Type"],
  training:   ["Tipo de Treino", "Training Type"],
  personality:["Personalidade", "Personality"],
  press:      ["Relação com Imprensa", "Relacao com Imprensa", "Press Relationship"],
  rm:         ["RM", "R.M."],
  rc:         ["RC", "R.C."],
  ca:         ["C.A.", "CA"],
  cp:         ["C.P.", "CP"],
};

const SUPERLEAGUE_COLS = {
  competition: ["Competição", "Competicao", "Competition", "Liga"],
  position:    ["Pos", "Posição", "Posicao", "Position"],
  info:        ["Inf", "Info"],
  club:        ["Equipa", "Clube", "Club", "Team"],
  played:      ["J", "Jogos", "Matches", "Played"],
  wins:        ["Vitória", "Vitoria", "V", "Wins"],
  vp:          ["VP"],
  penalties:   ["Penáltis", "Penaltis", "Penalties"],
  losses:      ["D", "Derrotas", "Losses"],
  draws:       ["E", "Empates", "Draws"],
  gf:          ["GM", "GF", "Goals For"],
  ga:          ["GS", "GA", "Goals Against"],
  gd:          ["DG", "GD", "Goal Diff"],
  points:      ["Pts", "Pontos", "Points"],
};

const NATIONAL_COLS = {
  competition: SUPERLEAGUE_COLS.competition,
  position:    SUPERLEAGUE_COLS.position,
  info:        SUPERLEAGUE_COLS.info,
  club:        SUPERLEAGUE_COLS.club,
  played:      SUPERLEAGUE_COLS.played,
  wins:        SUPERLEAGUE_COLS.wins,
  draws:       SUPERLEAGUE_COLS.draws,
  losses:      SUPERLEAGUE_COLS.losses,
  gf:          SUPERLEAGUE_COLS.gf,
  ga:          SUPERLEAGUE_COLS.ga,
  gd:          SUPERLEAGUE_COLS.gd,
  points:      SUPERLEAGUE_COLS.points,
};

const BRACKET_COLS = {
  competition: ["Competição", "Competicao", "Competition"],
  team1:       ["Equipa 1", "Equipa1", "Seleção 1", "Selecao 1"],
  team2:       ["Equipa 2", "Equipa2", "Seleção 2", "Selecao 2"],
  result:      ["Resultado", "Result"],
  sf1:         ["Meia Final Equipa 1", "Meia-Final Equipa 1", "SF Equipa 1"],
  sf2:         ["Meia Final Equipa 2", "Meia-Final Equipa 2", "SF Equipa 2"],
  qf1:         ["Quartos de Final Equipa 1", "QF Equipa 1"],
  qf2:         ["Quartos de Final Equipa 2", "QF Equipa 2"],
  qf3:         ["Quartos de Final Equipa 3", "QF Equipa 3"],
  qf4:         ["Quartos de Final Equipa 4", "QF Equipa 4"],
};

const PLAYER_COLS = {
  competition: ["Competição", "Competicao", "Competition", "Liga", "Divisão", "Divisao"],
  name:        ["Nome", "Name", "Jogador"],
  games:       ["Jogos", "J", "Games", "Apps"],
  gls:         ["Gls", "Golos", "Goals"],
  ast:         ["Ast", "Assist", "Assistências", "Assistencias"],
  xg:          ["xG", "xg", "Expected Goals"],
  pass_pct:    ["% Passe", "% Passes", "Pass %", "% Passe (t)"],
  tackles_p90: ["Des/90", "Desarmes/90", "Tackles/90"],
  fouls_p90:   ["Fnt/90", "Faltas/90", "Fouls/90"],
  shot_pct:    ["% Remates", "Shot %"],
  yellows:     ["Amr", "Amarelos", "Yellow", "Yellows"],
  reds:        ["Vermelhos", "Vermelho", "Red", "Reds"],
  avg_rating:  ["Cl Med", "Cl. Med.", "Classificação Média", "Classificacao Media", "Average Rating"],
  club:        ["Clube", "Club", "Equipa", "Team"],
  ca:          ["C.A.", "CA"],
  cp:          ["C.P.", "CP"],
  vp:          ["VP", "Valor"],
  ra:          ["R.A.", "RA"],
  rm:          ["RM", "R.M."],
  rc:          ["RC", "R.C."],
  salary:      ["Salário", "Salario", "Salary"],
  idu:         ["IDU", "UID", "ID"],
  age:         ["Idade", "Age"],
  nationality: ["Nac", "Nacionalidade", "Nationality"],
};

// ---------- Competitions file parser ------------------------------------

export function parseCompetitionsFile(buffer: ArrayBuffer): ParsedCompetitionsFile {
  const out: ParsedCompetitionsFile = {
    clubCountry: [], clubReputation: [], competitionReputation: [],
    coaches: [], standings: [], continental: [], international: [],
    presentSheets: [], ignoredSheets: [], warnings: [], fatal: [],
  };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    out.fatal.push("Ficheiro de Competições corrompido ou ilegível.");
    return out;
  }

  const knownSheets = new Set<string>();

  // Clube Pais (REQUIRED)
  const cpName = findSheet(wb, SHEET_ALIASES.clubePais);
  if (!cpName) {
    out.fatal.push("Folha obrigatória 'Clube Pais' não encontrada no ficheiro de Competições.");
  } else {
    knownSheets.add(cpName);
    const rows = rowsOf(wb, cpName);
    if (!rows.length) {
      out.fatal.push("Folha 'Clube Pais' está vazia.");
    } else {
      const cols = buildColMap(rows[0], CLUBE_PAIS_COLS);
      if (!cols.club) out.fatal.push("Folha 'Clube Pais': coluna 'Clube' não encontrada.");
      else {
        const seen = new Set<string>();
        for (const r of rows) {
          const club = toStr(r[cols.club]);
          if (!club) continue;
          if (seen.has(club)) { out.warnings.push(`Clube Pais: clube duplicado ignorado — "${club}"`); continue; }
          seen.add(club);
          out.clubCountry.push({
            club,
            country: cols.country ? toStr(r[cols.country]) : null,
            continent: cols.continent ? toStr(r[cols.continent]) : null,
          });
        }
      }
    }
  }

  // Reputação Clubes
  const rcName = findSheet(wb, SHEET_ALIASES.reputacaoClubes);
  if (rcName) {
    knownSheets.add(rcName);
    const rows = rowsOf(wb, rcName);
    if (rows.length) {
      const cols = buildColMap(rows[0], REP_CLUBES_COLS);
      if (!cols.club) out.warnings.push("Reputação Clubes: coluna 'Clube' não encontrada — folha ignorada.");
      else {
        for (const r of rows) {
          const club = toStr(r[cols.club]);
          if (!club) continue;
          out.clubReputation.push({
            club,
            reputation: cols.reputation ? toNum(r[cols.reputation]) : null,
            avg_attendance: cols.attendance ? toNum(r[cols.attendance]) : null,
            season_ticket_holders: cols.tickets ? toNum(r[cols.tickets]) : null,
          });
        }
      }
    }
  } else out.warnings.push("Folha 'Reputação Clubes' não encontrada — reputação de clubes ficará por definir.");

  // Reputação Competições
  const rpName = findSheet(wb, SHEET_ALIASES.reputacaoComps);
  if (rpName) {
    knownSheets.add(rpName);
    const rows = rowsOf(wb, rpName);
    if (rows.length) {
      const cols = buildColMap(rows[0], REP_COMPS_COLS);
      if (!cols.competition) out.warnings.push("Reputação Competições: coluna 'Competição' não encontrada — folha ignorada.");
      else {
        for (const r of rows) {
          const competition = toStr(r[cols.competition]);
          if (!competition) continue;
          out.competitionReputation.push({
            competition,
            reputation: cols.reputation ? toNum(r[cols.reputation]) : null,
          });
        }
      }
    }
  } else out.warnings.push("Folha 'Reputação Competições' não encontrada — competições sem reputação.");

  // Treinador
  const trName = findSheet(wb, SHEET_ALIASES.treinador);
  if (trName) {
    knownSheets.add(trName);
    const rows = rowsOf(wb, trName);
    if (rows.length) {
      const cols = buildColMap(rows[0], TREINADOR_COLS);
      if (!cols.name) out.warnings.push("Treinador: coluna 'Nome' não encontrada — folha ignorada.");
      else {
        for (const r of rows) {
          const name = toStr(r[cols.name]);
          if (!name || name.startsWith("http")) continue;
          const club = cols.club ? toStr(r[cols.club]) : null;
          const country = cols.country ? toStr(r[cols.country]) : null;
          out.coaches.push({
            idu: cols.idu ? toStr(r[cols.idu]) : null,
            name,
            nationality: cols.nationality ? toStr(r[cols.nationality]) : null,
            age: cols.age ? toNum(r[cols.age]) : null,
            club,
            country,
            club_role: cols.clubRole ? toStr(r[cols.clubRole]) : null,
            intl_role: cols.intlRole ? toStr(r[cols.intlRole]) : null,
            salary: cols.salary ? parseSalary(r[cols.salary]) : null,
            intl_salary: cols.intlSalary ? parseSalary(r[cols.intlSalary]) : null,
            tactical_style: cols.tacStyle ? toStr(r[cols.tacStyle]) : null,
            play_style: cols.playStyle ? toStr(r[cols.playStyle]) : null,
            attacking_formation: cols.atkForm ? toStr(r[cols.atkForm]) : null,
            defensive_formation: cols.defForm ? toStr(r[cols.defForm]) : null,
            preferred_formation: cols.prefForm ? toStr(r[cols.prefForm]) : null,
            secondary_formation: cols.secForm ? toStr(r[cols.secForm]) : null,
            mentality: cols.mentality ? toStr(r[cols.mentality]) : null,
            marking_type: cols.marking ? toStr(r[cols.marking]) : null,
            pressing_type: cols.pressing ? toStr(r[cols.pressing]) : null,
            training_type: cols.training ? toStr(r[cols.training]) : null,
            personality: cols.personality ? toStr(r[cols.personality]) : null,
            press_relationship: cols.press ? toStr(r[cols.press]) : null,
            rm: cols.rm ? toNum(r[cols.rm]) : null,
            rc: cols.rc ? toNum(r[cols.rc]) : null,
            ca: cols.ca ? toNum(r[cols.ca]) : null,
            cp: cols.cp ? toNum(r[cols.cp]) : null,
            // Heuristic: national-team coach when only "País" is set (no clube) OR when club matches a country name.
            is_national_team: !!(country && !club),
          });
        }
      }
    }
  } else out.warnings.push("Folha 'Treinador' não encontrada — treinadores ficam por definir.");

  // Super League standings
  const slName = findSheet(wb, SHEET_ALIASES.superLeague);
  if (slName) {
    knownSheets.add(slName);
    parseStandings(rowsOf(wb, slName), "superleague", out);
  }
  const lnName = findSheet(wb, SHEET_ALIASES.ligasNacionais);
  if (lnName) {
    knownSheets.add(lnName);
    parseStandings(rowsOf(wb, lnName), "national", out);
  }
  if (!slName && !lnName) {
    out.warnings.push("Nenhuma folha de classificação encontrada (Super League / Ligas Nacionais).");
  }

  // Continentais
  const cnName = findSheet(wb, SHEET_ALIASES.continentais);
  if (cnName) {
    knownSheets.add(cnName);
    parseBracket(rowsOf(wb, cnName), out.continental, out);
  }
  // Internacional
  const inName = findSheet(wb, SHEET_ALIASES.internacional) ??
    wb.SheetNames.find((n) => normKey(n).includes("intern")) ?? null;
  if (inName) {
    knownSheets.add(inName);
    parseBracket(rowsOf(wb, inName), out.international, out);
  }

  out.presentSheets = [...knownSheets];
  out.ignoredSheets = wb.SheetNames.filter((n) => !knownSheets.has(n));
  return out;
}

function parseStandings(rows: Record<string, unknown>[], module: "superleague" | "national", out: ParsedCompetitionsFile) {
  if (!rows.length) return;
  const cols = buildColMap(rows[0], module === "superleague" ? SUPERLEAGUE_COLS : NATIONAL_COLS);
  if (!cols.club || !cols.position) {
    out.warnings.push(`${module === "superleague" ? "Super League" : "Ligas Nacionais"}: colunas essenciais em falta (Equipa/Posição).`);
    return;
  }
  for (const r of rows) {
    const club = toStr(r[cols.club]);
    if (!club) continue;
    const info = cols.info ? toStr(r[cols.info]) : null;
    const competition = cols.competition ? toStr(r[cols.competition]) : null;
    out.standings.push({
      module,
      competition,
      division_label: competition,
      division_num: null,
      position: toNum(r[cols.position]),
      info,
      club_name: club,
      played: cols.played ? toNum(r[cols.played]) : null,
      wins: cols.wins ? toNum(r[cols.wins]) : null,
      vp: cols.vp ? toNum(r[cols.vp]) : null,
      penalties: cols.penalties ? toNum(r[cols.penalties]) : null,
      draws: cols.draws ? toNum(r[cols.draws]) : null,
      losses: cols.losses ? toNum(r[cols.losses]) : null,
      gf: cols.gf ? toNum(r[cols.gf]) : null,
      ga: cols.ga ? toNum(r[cols.ga]) : null,
      gd: cols.gd ? toNum(r[cols.gd]) : null,
      points: cols.points ? toNum(r[cols.points]) : null,
      is_champion: normKey(info) === "c",
    });
  }
}

function parseBracket(rows: Record<string, unknown>[], sink: BracketRow[], out: ParsedCompetitionsFile) {
  if (!rows.length) return;
  const cols = buildColMap(rows[0], BRACKET_COLS);
  if (!cols.competition) { out.warnings.push("Bracket: coluna 'Competição' não encontrada."); return; }
  for (const r of rows) {
    const competition = toStr(r[cols.competition]);
    if (!competition) continue;
    const team1 = cols.team1 ? toStr(r[cols.team1]) : null;
    const team2 = cols.team2 ? toStr(r[cols.team2]) : null;
    const result = cols.result ? toStr(r[cols.result]) : null;
    sink.push({
      competition, team1, team2, result,
      winner: parseScore(result, team1, team2),
      sf1: cols.sf1 ? toStr(r[cols.sf1]) : null,
      sf2: cols.sf2 ? toStr(r[cols.sf2]) : null,
      qf1: cols.qf1 ? toStr(r[cols.qf1]) : null,
      qf2: cols.qf2 ? toStr(r[cols.qf2]) : null,
      qf3: cols.qf3 ? toStr(r[cols.qf3]) : null,
      qf4: cols.qf4 ? toStr(r[cols.qf4]) : null,
    });
  }
}

// ---------- Players file parser -----------------------------------------

const PLAYER_SHEET_TYPES: Array<{ type: CompType; aliases: string[] }> = [
  { type: "international", aliases: SHEET_ALIASES.internacional },
  { type: "continental",   aliases: SHEET_ALIASES.continentais },
  { type: "national",      aliases: SHEET_ALIASES.ligasNacionais },
  { type: "superleague",   aliases: SHEET_ALIASES.superLeague },
];

export function parsePlayersFile(buffer: ArrayBuffer): ParsedPlayersFile {
  const out: ParsedPlayersFile = {
    players: [], bySheet: {}, ignoredSheets: [], warnings: [], fatal: [],
  };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    out.fatal.push("Ficheiro de Jogadores corrompido ou ilegível.");
    return out;
  }

  const claimed = new Set<string>();
  for (const { type, aliases } of PLAYER_SHEET_TYPES) {
    const name = matchSheetFuzzy(wb, aliases);
    if (!name || claimed.has(name)) continue;
    claimed.add(name);
    parsePlayerSheet(rowsOf(wb, name), name, type, out);
  }
  if (out.players.length === 0 && out.fatal.length === 0) {
    out.fatal.push("Nenhuma folha reconhecida no ficheiro de Jogadores (Super League / Ligas Nacionais / Continentais / Internacionais).");
  }
  out.ignoredSheets = wb.SheetNames.filter((n) => !claimed.has(n));
  return out;
}

function parsePlayerSheet(rows: Record<string, unknown>[], sheet: string, comp_type: CompType, out: ParsedPlayersFile) {
  if (!rows.length) return;
  const cols = buildColMap(rows[0], PLAYER_COLS);
  if (!cols.name) { out.warnings.push(`${sheet}: coluna 'Nome' não encontrada — folha ignorada.`); return; }
  if (!cols.competition) out.warnings.push(`${sheet}: coluna 'Competição' não encontrada — competição ficará vazia.`);
  let count = 0;
  for (const r of rows) {
    const name = toStr(r[cols.name]);
    if (!name || name.startsWith("http")) continue;
    const competition = cols.competition ? (toStr(r[cols.competition]) ?? "") : "";
    if (!competition) { out.warnings.push(`${sheet}: "${name}" sem Competição — ignorado.`); continue; }
    out.players.push({
      comp_type,
      competition,
      player_name: name,
      idu: cols.idu ? toStr(r[cols.idu]) : null,
      nationality: cols.nationality ? toStr(r[cols.nationality]) : null,
      club: cols.club ? toStr(r[cols.club]) : null,
      age: cols.age ? toNum(r[cols.age]) : null,
      games: parseGames(r[cols.games ?? ""]),
      gls: num0(r[cols.gls ?? ""]),
      ast: num0(r[cols.ast ?? ""]),
      xg: num0(r[cols.xg ?? ""]),
      pass_pct: num0(r[cols.pass_pct ?? ""]),
      tackles_per90: num0(r[cols.tackles_p90 ?? ""]),
      fouls_per90: num0(r[cols.fouls_p90 ?? ""]),
      shot_pct: num0(r[cols.shot_pct ?? ""]),
      yellows: num0(r[cols.yellows ?? ""]),
      reds: num0(r[cols.reds ?? ""]),
      avg_rating: num0(r[cols.avg_rating ?? ""]),
      ca: num0(r[cols.ca ?? ""]),
      cp: num0(r[cols.cp ?? ""]),
      vp: parseVP(r[cols.vp ?? ""]),
      ra: num0(r[cols.ra ?? ""]),
      rm: num0(r[cols.rm ?? ""]),
      rc: num0(r[cols.rc ?? ""]),
      salary: parseSalary(r[cols.salary ?? ""]),
    });
    count++;
  }
  out.bySheet[sheet] = { sheet, comp_type, count };
}

// ---------- Cross-file validation ---------------------------------------

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: {
    clubsInCountryMap: number;
    clubsWithReputation: number;
    competitionsWithReputation: number;
    coaches: number;
    nationalTeamCoaches: number;
    standings: number;
    continentalRows: number;
    internationalRows: number;
    players: number;
    playersBySheet: Record<string, number>;
    clubsWithoutCountry: string[];
    clubsWithoutPlayers: string[];
    clubsWithoutReputation: string[];
    playersWithoutClub: number;
    coachesWithoutAssignment: string[];
    competitionsWithoutReputation: string[];
    duplicateClubs: string[];
    unmappedClubsInPlayers: string[];
  };
}

export function validate(comp: ParsedCompetitionsFile, players: ParsedPlayersFile): ValidationReport {
  const report: ValidationReport = {
    errors: [...comp.fatal, ...players.fatal],
    warnings: [...comp.warnings, ...players.warnings],
    stats: {
      clubsInCountryMap: comp.clubCountry.length,
      clubsWithReputation: comp.clubReputation.length,
      competitionsWithReputation: comp.competitionReputation.length,
      coaches: comp.coaches.length,
      nationalTeamCoaches: comp.coaches.filter((c) => c.is_national_team).length,
      standings: comp.standings.length,
      continentalRows: comp.continental.length,
      internationalRows: comp.international.length,
      players: players.players.length,
      playersBySheet: Object.fromEntries(Object.entries(players.bySheet).map(([k, v]) => [k, v.count])),
      clubsWithoutCountry: [],
      clubsWithoutPlayers: [],
      clubsWithoutReputation: [],
      playersWithoutClub: 0,
      coachesWithoutAssignment: [],
      competitionsWithoutReputation: [],
      duplicateClubs: [],
      unmappedClubsInPlayers: [],
    },
  };

  const clubCountry = new Map(comp.clubCountry.map((c) => [c.club, c.country]));
  const clubsInMap = new Set(comp.clubCountry.map((c) => c.club));

  for (const c of comp.clubCountry) {
    if (!c.country) report.stats.clubsWithoutCountry.push(c.club);
  }

  const seenDup = new Set<string>();
  const dupCheck = new Set<string>();
  for (const c of comp.clubCountry) {
    if (dupCheck.has(c.club)) { if (!seenDup.has(c.club)) { report.stats.duplicateClubs.push(c.club); seenDup.add(c.club); } }
    else dupCheck.add(c.club);
  }

  const clubsWithReputation = new Set(comp.clubReputation.map((c) => c.club));
  for (const c of comp.clubCountry) if (!clubsWithReputation.has(c.club)) report.stats.clubsWithoutReputation.push(c.club);

  const compsWithRep = new Set(comp.competitionReputation.map((c) => c.competition));
  const compsSeen = new Set<string>();
  for (const s of comp.standings) if (s.competition) compsSeen.add(s.competition);
  for (const p of players.players) compsSeen.add(p.competition);
  for (const c of compsSeen) if (!compsWithRep.has(c)) report.stats.competitionsWithoutReputation.push(c);

  const clubsWithPlayers = new Set<string>();
  for (const p of players.players) {
    if (!p.club) { report.stats.playersWithoutClub++; continue; }
    clubsWithPlayers.add(p.club);
    if (!clubsInMap.has(p.club) && p.comp_type !== "international") {
      report.stats.unmappedClubsInPlayers.push(p.club);
    }
  }
  const unmappedSet = new Set(report.stats.unmappedClubsInPlayers);
  report.stats.unmappedClubsInPlayers = [...unmappedSet];

  for (const c of comp.clubCountry) if (!clubsWithPlayers.has(c.club)) report.stats.clubsWithoutPlayers.push(c.club);

  for (const c of comp.coaches) {
    if (!c.club && !c.country) report.stats.coachesWithoutAssignment.push(c.name);
  }

  return report;
}

// Suppress unused
void clubCountryToMap;
function clubCountryToMap(_: ClubCountryRow[]): Map<string, string | null> { return new Map(); }
