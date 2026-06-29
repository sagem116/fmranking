## Plano — Importação multi-folha + Rankings de Jogadores e Competições

Vou adicionar tudo isto **sem mexer** nos rankings atuais de Clubes/Treinadores/Países nem nas importações existentes.

---

### 1) Novo importador XLSX multi-folha

Nova secção na página `/importar` chamada **"Importar Jogadores & Competições (multi-folha)"**, separada do importador atual.

Aceita um único `.xlsx` com qualquer subconjunto destas folhas (case-insensitive, ignora as que faltem, sem erro):

| Nome da folha | Tipo de competição interno |
|---|---|
| Divisão / Divisao / Super League | `superleague` |
| Ligas Nacionais / Nacional | `national` |
| Continental / Continentais | `continental` |
| Internacional / Internacionais | `international` |

Colunas esperadas (header fuzzy match, tolerante a acentos):
`Divisão · País · Nome · IDU · Nac · Clube · Gls · Ast · Jogos · HdJ · C.A. · C.P. · VP · Salário · R.A. · RM · RC · Idade`

Regras:
- Pede a época (ano) no formulário, igual ao importador atual.
- Linhas vazias e linhas sem `Nome` são ignoradas.
- **Atualiza em vez de duplicar**: antes de inserir, faz `DELETE FROM player_stats WHERE season_year = ? AND comp_type IN (folhas-presentes)`. Folhas em falta não apagam nada.
- **Chave de unicidade na inserção**: `(season_year, comp_type, IDU)` — se vier o mesmo IDU duas vezes dentro da mesma folha, fica o último. IDU em falta gera chave sintética por `Nome|Clube|Divisão`.
- Recalcula os agregados das competições no fim da importação (ver §4).

### 2) Nova tabela `player_stats` (Cloud)

Vou criar uma tabela nova dedicada — não toca em `players`.

Colunas: `id`, `season_year`, `comp_type` (`superleague|national|continental|international`), `competition` (texto: nome da divisão/competição), `country`, `continent` (calculado para continentais), `player_name`, `idu`, `nationality`, `club`, `gls`, `ast`, `games`, `hdj`, `ca`, `cp`, `vp`, `salary`, `ra`, `rm`, `rc`, `age`, `created_at`.

Índices: `(season_year, comp_type)`, `(idu)`, `(competition)`, `(club)`.

RLS pública leitura (igual às outras tabelas do projeto) + GRANTs `anon/authenticated/service_role`.

Tabela de agregados pré-calculados `competition_stats` para performance (média por competição × época × tipo): evita recomputar nas mudanças de filtro.

### 3) Novo separador "Jogadores" em `/rankings`

Adiciona-se ao toggle existente (Clubes / Treinadores / Países / **Jogadores** / **Competições**).

Sub-tabs dentro de Jogadores: **Golos · Assistências · Jogos · Homem do Jogo · C.A. · C.P.**

Cada tab respeita os mesmos controlos da página:
- Filtro de competição: **Super Leagues · Ligas Nacionais · Continentais · Internacional · Unificado**
- Época (todas / específica)
- Ponderado / Bruto
- Com / Sem decaimento
- Pesquisa (nome, clube, competição, país, nacionalidade)
- Ordenação ascendente/descendente em qualquer coluna
- Paginação (mesmo componente)

**Modo Unificado**: agrupa por `IDU` somando `gls/ast/games/hdj` em todas as competições. Para C.A./C.P. usa o valor da competição com maior peso (o "perfil principal" do jogador na época). Linhas sem IDU não entram no Unificado (com aviso).

**Ponderação e decaimento**: reutilizo `weightForCompetition(...)` e `decayFactor(year)` do motor existente (`fm-rankings.ts`). Em modo Ponderado, cada estatística é multiplicada por `weight × decay`; em Bruto é o valor cru.

### 4) Novo separador "Competições"

Mesma localização, uma linha por competição com médias de `CA · CP · VP · Salário · RA · RM · RC · Idade` (todos os jogadores dessa competição, NaN/0 ignorados).

Divisão por tipo igual aos jogadores. Colunas extra:
- Ligas Nacionais → coluna **País**
- Continentais → coluna **Continente** (mapa estático Europa/AmSul/AmNorte/Ásia/África/Oceânia por nome de competição; fallback "—")

Em Ponderado, as médias são ponderadas pelo peso da competição × decaimento da época; em Bruto são médias simples.

Agregados pré-calculados em `competition_stats` (escritos no fim da importação) — a UI apenas filtra e ordena.

### 5) Integração com pesos existentes

Não crio sistema novo. Leio `config_weights` via `useActiveConfig()` (já em uso) e aplico os mesmos multiplicadores de competição + decaimento que os rankings de Clubes/Treinadores/Países usam.

### 6) Ficheiros

Novos:
- `src/lib/fm-player-stats-parser.ts` — parsing XLSX multi-folha
- `src/lib/fm-player-stats-db.ts` — upsert/delete/fetch + recálculo de `competition_stats`
- `src/lib/fm-player-rankings.ts` — motor de rankings (Jogadores + Competições, modos Bruto/Ponderado/Decaimento/Unificado)
- `src/lib/fm-continents.ts` — já existe; estendo com mapa de competições continentais → continente, se faltar
- `src/components/PlayerRankingsTable.tsx`
- `src/components/CompetitionRankingsTable.tsx`
- `src/components/PlayerStatsImporter.tsx` (cartão dentro de `/importar`)
- Migração Supabase: `player_stats` + `competition_stats` + RLS/GRANTs

Alterados (cirurgicamente):
- `src/routes/rankings.tsx` — adicionar duas opções no toggle e respetivos painéis
- `src/routes/importar.tsx` — adicionar o cartão do novo importador
- `src/lib/useRankings.ts` — expor hook adicional `usePlayerRankings()` (não mexe no atual)

### Detalhes técnicos

- Parser usa `xlsx` (SheetJS). Já está nas deps; se não estiver, `bun add xlsx`.
- Header matching: normalizo (`lowercase`, sem acentos, sem pontos). Sinónimos: `pais|país`, `nac|nacionalidade`, `clube|club`, `divisao|divisão|liga|competicao|competição`.
- Continentes: tabela embutida com nomes oficiais ("UEFA Champions League" → Europa, "Copa Libertadores" → América do Sul, etc.); itens não mapeados → "—".
- Performance: agregados em `competition_stats` calculados durante a importação. Filtros e ordenação no cliente são feitos sobre os agregados (≤ algumas centenas de linhas).
- Para 100k+ jogadores: paginação server-side via Supabase `range()` (25/pág) com `order` na coluna ativa. Pesquisa usa `ilike` em `player_name/club/competition/country/nationality`.

### Fora de scope (confirma se quiseres)

- Editor manual de pesos por competição para os novos rankings (uso os existentes em `config_weights`).
- Hall of Fame / perfis individuais com base nestes novos dados — fica para iteração seguinte.

Confirma e implemento.