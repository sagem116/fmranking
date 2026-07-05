// Variable catalogs for custom formulas / filters / rankings per entity type.

export type EntityKind = "jogador" | "clube" | "competicao" | "pais" | "treinador";

export interface VarDef {
  key: string;        // UPPERCASE variable name used in formulas
  label: string;      // Human label
  group?: string;     // optional grouping
}

export const PLAYER_VARS: VarDef[] = [
  { key: "GLS", label: "Golos", group: "Performance" },
  { key: "AST", label: "Assistências", group: "Performance" },
  { key: "JOGOS", label: "Jogos", group: "Performance" },
  { key: "HDJ", label: "Homem do Jogo", group: "Performance" },
  { key: "CA", label: "Current Ability", group: "Atributos" },
  { key: "CP", label: "Potential Ability", group: "Atributos" },
  { key: "RA", label: "Rating Atual", group: "Atributos" },
  { key: "RM", label: "Rating Médio", group: "Atributos" },
  { key: "RC", label: "Rating Competição", group: "Atributos" },
  { key: "IDADE", label: "Idade", group: "Atributos" },
  { key: "VP", label: "Valor de Mercado", group: "Financeiro" },
  { key: "SALARIO", label: "Salário", group: "Financeiro" },
  { key: "REPUTACAO_CLUBE", label: "Reputação do Clube", group: "Externo" },
];

export const CLUB_VARS: VarDef[] = [
  { key: "PONTOS", label: "Pontos (raw)", group: "Ranking" },
  { key: "PONTOS_PONDERADOS", label: "Pontos Ponderados", group: "Ranking" },
  { key: "TITULOS", label: "Títulos", group: "Ranking" },
  { key: "EPOCAS", label: "Épocas analisadas", group: "Ranking" },
  { key: "REPUTACAO", label: "Reputação", group: "Externo" },
  { key: "VP_TOTAL", label: "V.P. Total (plantel)", group: "Plantel" },
  { key: "SALARIO_TOTAL", label: "Salário Total (plantel)", group: "Plantel" },
  { key: "CA_MEDIO", label: "C.A. Médio", group: "Plantel" },
  { key: "CP_MEDIO", label: "C.P. Médio", group: "Plantel" },
  { key: "IDADE_MEDIA", label: "Idade Média", group: "Plantel" },
  { key: "N_JOGADORES", label: "Nº de Jogadores", group: "Plantel" },
];

export const COMPETITION_VARS: VarDef[] = [
  { key: "REPUTACAO_MEDIA", label: "Reputação Média (Clubes)", group: "Reputação" },
  { key: "REPUTACAO_MANUAL", label: "Reputação Manual", group: "Reputação" },
  { key: "CA_MEDIO", label: "C.A. Médio", group: "Estatísticas" },
  { key: "CP_MEDIO", label: "C.P. Médio", group: "Estatísticas" },
  { key: "RA_MEDIO", label: "R.A. Médio", group: "Estatísticas" },
  { key: "RM_MEDIO", label: "R.M. Médio", group: "Estatísticas" },
  { key: "RC_MEDIO", label: "R.C. Médio", group: "Estatísticas" },
  { key: "VP_MEDIO", label: "V.P. Médio", group: "Financeiro" },
  { key: "SALARIO_MEDIO", label: "Salário Médio", group: "Financeiro" },
  { key: "VP_TOTAL", label: "V.P. Total", group: "Financeiro" },
  { key: "SALARIO_TOTAL", label: "Salário Total", group: "Financeiro" },
  { key: "IDADE_MEDIA", label: "Idade Média", group: "Estatísticas" },
  { key: "N_JOGADORES", label: "Nº de Jogadores", group: "Estatísticas" },
];

export const COUNTRY_VARS: VarDef[] = [
  { key: "PONTOS", label: "Pontos (raw)", group: "Ranking" },
  { key: "PONTOS_PONDERADOS", label: "Pontos Ponderados", group: "Ranking" },
  { key: "TITULOS", label: "Títulos", group: "Ranking" },
  { key: "FINAIS", label: "Finais", group: "Ranking" },
  { key: "MEIAS", label: "Meias-finais", group: "Ranking" },
  { key: "QUARTOS", label: "Quartos-de-final", group: "Ranking" },
  { key: "N_JOGADORES", label: "Nº de Jogadores", group: "Demografia" },
  { key: "N_CLUBES", label: "Nº de Clubes", group: "Demografia" },
  { key: "VP_TOTAL", label: "V.P. Total (jogadores)", group: "Financeiro" },
  { key: "SALARIO_TOTAL", label: "Salário Total (jogadores)", group: "Financeiro" },
];

export const COACH_VARS: VarDef[] = [
  { key: "PONTOS_PONDERADOS", label: "Pontos Ponderados", group: "Ranking" },
  { key: "PONTOS", label: "Pontos (raw)", group: "Ranking" },
  { key: "TITULOS", label: "Títulos", group: "Ranking" },
  { key: "EPOCAS", label: "Épocas registadas", group: "Carreira" },
  { key: "N_CLUBES", label: "Nº de Clubes", group: "Carreira" },
  { key: "N_MODULOS", label: "Nº de Módulos", group: "Carreira" },
  { key: "NACIONAL", label: "Trabalhou como selecionador?", group: "Carreira" },
];

export function varsForEntity(kind: EntityKind): VarDef[] {
  switch (kind) {
    case "jogador": return PLAYER_VARS;
    case "clube": return CLUB_VARS;
    case "competicao": return COMPETITION_VARS;
    case "pais": return COUNTRY_VARS;
    case "treinador": return COACH_VARS;
  }
}

export const ENTITY_LABEL: Record<EntityKind, string> = {
  jogador: "Jogadores",
  clube: "Clubes",
  competicao: "Competições",
  pais: "Países",
  treinador: "Treinadores",
};