
# Estatísticas de Ligas — Plano de implementação

Vou criar duas novas páginas espelhadas com a mesma engine de rankings, uma alimentada por **ligas nacionais** e outra pelas **divisões da Super League** (cada divisão tratada como uma "liga" independente).

## Rotas novas

- `src/routes/national.estatisticas-ligas.tsx` → `/national/estatisticas-ligas`
- `src/routes/super-league.estatisticas-divisoes.tsx` → `/super-league/estatisticas-divisoes`

Ambas usam o mesmo componente partilhado para evitar duplicação.

## Engine partilhada (`src/lib/fm-league-stats.ts`)

Função `computeLeagueStats(data, scope, filters)` que devolve, por liga/divisão, um agregado com tudo o necessário para os 15 rankings:

```
{ league, country, continent, season,
  nTeams, nPlayers,
  caAvg, cpAvg, vpAvg, salaryAvg, ageAvg,
  gmTotal, gsTotal, gamesTotal, gmPerGame, gsPerGame, spectaclePerGame,
  pointsTotal, pointsStd, valueStd, caStd,
  leaderPts, secondPts, leaderGap,
  offEfficiency }   // pontos / golos
```

- Jogadores: agregar a partir de `players` filtrados pelo `module` adequado (ou pelos clubes pertencentes à liga/divisão na época selecionada).
- Standings: agregar `gf/ga/played/points` por liga/divisão+época para golos, jogos, dominância, desvios, competitividade.
- Idade/CA/CP/Valor/Salário/Salário: média sobre jogadores (não-zero).
- Desvio-padrão: usado em Competitividade, Paridade Financeira/Técnica.

Helper de normalização 0–100 (min-max sobre o conjunto filtrado) e cálculo dos scores compostos (Qualidade Global, Poder Financeiro).

Cada ranking devolve `{ key, label, columns, sortDefault, rows }`. Catálogo `RANKINGS: RankingDef[]` com os 15 rankings listados.

## Componente partilhado (`src/components/LeagueStatsPage.tsx`)

Recebe `scope: "national" | "superleague"` e renderiza:

1. **Toggle de Rankings** (`ToggleGroup`, wrap, com 15 botões).
2. **Cartão de filtros avançados**:
   - Continente, País (multi/single via `EntityCombobox`)
   - Época (intervalo de épocas — de/até)
   - Divisão mínima / máxima (apenas no scope SuperLeague; em Nacional é livre)
   - Nº mínimo/máximo de equipas
   - Intervalos numéricos: Valor min/max, CA min/max, Salário min/max, Idade min/max
   - Botão **Limpar**
3. **Barra de utilitários**: pesquisa por nome, seletor de colunas configuráveis, exportar **CSV** e **Excel** (usa skill XLSX/`xlsx` via Blob), seletor de **ligas a comparar** (multi-select; mostra cartão de comparação).
4. **Tabela dinâmica** com `SortableTh` (asc/desc bidirecional já existente), paginação (25/pág).
5. **Gráficos** (`recharts`, já presente): barras top-10 do ranking ativo + gráfico radar dos selecionados + gráfico de evolução histórica (score do ranking ativo por época) para as ligas selecionadas.

## Exportação

- CSV: gerado em memória, `Blob` + download — sem deps novas.
- Excel: usa `xlsx` (SheetJS). Instalar `bun add xlsx` se ainda não estiver.

## Detalhes técnicos

- Os filtros operam **antes** do cálculo de normalização para que os scores 0–100 reflitam o conjunto filtrado.
- "Divisão" no scope SuperLeague usa `division_num`; cada (divisão) é uma "liga" com label `Super League Dx`.
- "Liga" no scope Nacional usa `division_label` (caindo para `league` dos jogadores quando preciso).
- Tudo no cliente, reaproveitando `useRankings()` que já carrega todos os dados.
- Sidebar: adicionar entradas para as duas novas páginas (debaixo das secções "Super League" e "Nacional").

## Itens fora do scope (a confirmar contigo se precisares)

- Persistir preferências de colunas/filtros entre sessões — não vou guardar para já.
- Gráfico radar com mais de ~6 ligas fica ilegível; vou limitar comparação a 6.

Carrego e implemento se aprovares.
