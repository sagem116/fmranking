# Expansão dos Rankings Mundiais

Plano dividido em 6 blocos, todos reutilizando os componentes existentes (`PlayerRankingsView`, `ClubStatsRankingsView`, `EvolutionChart`, filtros `Select`/`Input`, pesos via `useActiveConfig` + `compWeight`/`decayFactor`).

---

## 1. Correção da coluna "País" (Clubes & Competições)

Hoje, em `ClubStatsRankingsView`, o país do clube é derivado dos sheets nacional/superleague (país do clube). Vou mudar para **país da competição** sempre.

- Em `src/components/ClubStatsRankingsView.tsx`: usar `p.country` directamente como país-da-competição (mais frequente por clube+competição). Remover priorização por tipo de folha.
- Mesma regra usada onde aparece "País" no Ranking de Competições.
- Filtros País/Continente passam a filtrar pelo país da competição.

> Trade-off: clubes que joguem fora do seu país (raro) aparecem associados ao país da competição — é o pedido.

---

## 2. Ranking de Competições — tab "Todas"

Em `PlayerRankingsView` (tab Competições, sub-tab "Todas"):

- **Continuam médias ponderadas**: C.A., C.P., R.A., R.M., R.C., Idade.
- **Passam a somas brutas**: V.P. e Salário → soma de `vp`/`salary` de todos os clubes (não jogadores duplicados) da competição.
- Restantes sub-tabs (Super Leagues / Ligas Nacionais / Continentais / Internacional): comportamento atual mantido.

Implementação: alterar agregação interna para guardar `sumVP_clubs`, `sumSalary_clubs` (dedup por clube dentro da competição) e usá-los só na vista "Todas".

---

## 3. Sugestão de Pesos — novas variáveis

Em `src/routes/sugestao-pesos.tsx` adicionar 2 métricas:

1. **Reputação Média dos Clubes da Competição** — automática, calculada a partir de `loadReputations()` + alias dos clubes da competição.
2. **Reputação Manual da Competição** — guardada na BD.

### BD (migration nova)
```sql
CREATE TABLE public.competition_reputation (
  competition text PRIMARY KEY,
  reputation numeric NOT NULL,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_reputation TO authenticated;
GRANT SELECT ON public.competition_reputation TO anon;
GRANT ALL  ON public.competition_reputation TO service_role;
ALTER TABLE public.competition_reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read"  ON public.competition_reputation FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public write" ON public.competition_reputation FOR ALL  TO anon, authenticated USING (true) WITH CHECK (true);
```

UI: editor inline na página Sugestão de Pesos (lista de competições + input numérico). Ambas as métricas exportadas pelo backup global.

---

## 4. Nova página `/estatisticas` (menu Rankings)

Ficheiro: `src/routes/estatisticas.tsx` + componentes em `src/components/estatisticas/`.

Mesmo header de tabs de categoria que `ClubStatsRankingsView` (Unificado / Super Leagues / Ligas Nacionais / Continentais / Internacional), partilhando filtros (época, pesquisa, país, continente, competição) e respeitando ponderado/bruto + decaimento (via `useActiveConfig`).

### Layout
```text
┌─ Tabs Categoria ───────────────────────────────────┐
├─ Dashboard KPIs (9 cards reactivos aos filtros)    │
├─ Sub-tabs (uma view de cada vez):                  │
│  • Competições   • Nacionalidades p/ Competição    │
│  • Jogadores p/ Nacionalidade • Jogadores p/ Idade │
│  • Clubes p/ País  • Clubes p/ Competição          │
│  • Jogadores p/ Competição                         │
│  • Clubes/Jogadores p/ Continente                  │
│  • Continentes                                     │
│  • Distribuição Reputação / C.A. / V.M. / Salário  │
│  • Evolução por Época (dropdown de métrica)        │
└────────────────────────────────────────────────────┘
```

Cada tabela: ordenação por coluna, paginação e **drill-down** — ao clicar na linha abre um `Dialog` (`PlayerStatTable`) com os registos filtrados (jogadores/clubes/competições conforme contexto).

Distribuições renderizadas com Recharts (`BarChart`); Evolução com `EvolutionChart` existente.

---

## 5. Perfis com gráfico dinâmico

Substituir os gráficos fixos em `src/components/NewStatsSections.tsx` (e onde aplicável nos perfis de Jogadores/Clubes/Países/Competições) por um único componente novo `<DynamicMetricChart />`:

- Dropdown com métricas relevantes ao tipo de perfil (Golos, Assistências, Jogos, HdJ, C.A., C.P., V.P., Salário, R.A./M/C, Idade, Ranking, Peso).
- Eixo X = épocas; eixo Y = valor.
- Reutiliza `EvolutionChart` / Recharts já no projeto.
- Remove os gráficos antigos hardcoded mas mantém tabelas de records/seasons.

---

## 6. Reutilização

- Filtros, paginação, ordenação e drill-down extraídos para hooks/componentes já existentes (`SortableTh`, `Select`, `Input`, `Dialog`, `EntityCombobox`).
- Cálculos de peso: `compWeight` + `decayFactor` via `useActiveConfig` — sem duplicar lógica.
- Backup global (`fm-global-backup.ts`): incluir reputação manual de competições.

---

## Detalhes técnicos resumidos

- **Migrations**: 1 nova (tabela `competition_reputation`).
- **Novos ficheiros**:
  - `src/routes/estatisticas.tsx`
  - `src/components/estatisticas/*.tsx` (Dashboard, sub-tabs, DrillDownDialog)
  - `src/components/DynamicMetricChart.tsx`
  - `src/lib/fm-competition-reputation.ts` (load/save + cache localStorage de backup)
- **Edições**: `ClubStatsRankingsView`, `PlayerRankingsView`, `sugestao-pesos`, `NewStatsSections`, perfis (`clubes.$name`, `jogadores.$name`, `paises.$name`, `competicoes.$name`), `AppShell` (menu Rankings → Estatísticas), `fm-global-backup`.
- **Sem alterações** nos rankings de Clubes / Treinadores / Países existentes.

Confirma e avanço com a implementação (pode demorar várias rondas dado o âmbito).