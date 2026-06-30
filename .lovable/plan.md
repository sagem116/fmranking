## Visão geral

Sete sistemas que estendem a aplicação sem mexer nos dados importados via Excel. Toda a personalização vive em `localStorage` (mesma estratégia já usada para pesos, reputações, etc.) e é reaproveitada pelos rankings, perfis, exportações e nova página de Insights.

Princípios transversais:
- Reutilizar `useRankings`, `usePlayerStatsData`, `useClubReputation`, `useCompetitionReputation` — não duplicar lógica de cálculo.
- Tudo é reversível: editar, duplicar, eliminar em qualquer item criado pelo utilizador.
- Versionado por `schemaVersion` em cada chave de `localStorage` para o backup JSON aceitar versões antigas.

---

## 1. Rankings Personalizados

Nova rota `/rankings-personalizados` (item lateral) com lista de rankings criados + botão "Novo Ranking".

Editor em modal/diálogo com:
- Entidade: Jogadores / Clubes / Competições / Países.
- Nome + descrição opcional.
- Filtros: reaproveita os mesmos controlos já existentes (idade, país, continente, competição, clube, intervalos numéricos para VP/Salário/CA/CP/RA/RM/RC/Idade, nacionalidade, etc.) num componente partilhado `EntityFilterPanel`.
- Ordenação: dropdown com todas as métricas disponíveis para a entidade (incluindo fórmulas personalizadas — ver §2) + crescente/decrescente.
- Pré-visualização ao vivo da tabela enquanto edita.

Persistência em `localStorage` chave `fm:custom-rankings`. Cada item:
```
{ id, name, description?, entity, filters, sortBy, sortDir, createdAt, updatedAt }
```

Ações por linha: aplicar / editar / duplicar / eliminar.

---

## 2. Fórmulas Personalizadas

Nova rota `/formulas-personalizadas`. Editor:
- Nome, entidade alvo, casas decimais, fórmula como expressão de texto.
- Validação: parser próprio (sem `eval`) usando `expr-eval` ou implementação manual com tokens + AST simples. Variáveis disponíveis dependem da entidade (ex: jogador → CA, CP, GLS, AST, IDADE, VP, SALARIO, REPUTACAO, etc.). Em caso de variável desconhecida ou sintaxe inválida → mostra erro vermelho e não permite gravar.
- Pré-visualização: calcula em 5 entidades de exemplo enquanto edita.

Persistência em `fm:custom-formulas`. Item: `{ id, name, entity, expr, decimals, ast, createdAt }`.

Disponibilização automática:
- Helper `evaluateFormula(formula, entityData)` exposto para Rankings Personalizados (§1) como métrica de ordenação.
- Coluna extra opcional nas tabelas dos rankings padrão (botão "Colunas" no header → escolhe quais fórmulas mostrar).
- Coluna nos perfis quando há fórmulas para essa entidade.
- Incluído em export Excel/PDF e na exportação de qualquer ranking personalizado.

---

## 3. Insights Automáticos

Nova rota `/insights`. Após cada importação, snapshot dos agregados é guardado em `fm:insights-snapshots` (mantém últimos 10):
```
{ importedAt, label, aggregates: { competitions, countries, clubs, players, world } }
```

Geração de insights compara último snapshot vs anterior:
- Liga A ultrapassou Liga B em VP total / reputação / salário médio.
- Variação % por competição (subiu/desceu).
- Mudanças de líder em métricas-chave (golos, assistências, CA, VP).
- Entradas/saídas do Top 100 mundial de clubes.
- Variação da média de idade global, total de jogadores, nacionalidade dominante.

Cada insight: `{ title, valuePrev, valueCurr, deltaAbs, deltaPct, severity }`. Ordenados por severidade calculada (variação % * peso da métrica).

UI com cards agrupados por categoria (Competições, Clubes, Jogadores, Mundo) + filtro por severidade.

---

## 4. Drill-Down Universal

Componente partilhado `DrillCell` que torna clicável qualquer célula agregada e abre o `DrillDialog` (já existe em `EstatisticasPage`) com lista filtrada.

Aplicação:
- Tabelas de Estatísticas (já têm drill, generalizar).
- Tabela de Países / Clubes em rankings (clicar no nº de jogadores ou nº de clubes).
- Coluna "Jogadores" / "Clubes" / "Pontos" / "VP Total" em qualquer agregação.
- Card de país → "1.623 jogadores" clicável.
- Card de continente → lista de clubes.

Cada `DrillCell` recebe `{ predicate, columns, title }` e usa os dados já em memória — zero round-trip ao backend.

---

## 5. Filtros Guardados

Persistência `fm:saved-filters`. Cada item: `{ id, name, description?, entity, filters }`.

UI: pequeno botão "Filtros guardados" ao lado do painel de filtros em qualquer página com filtros (Rankings padrão, Rankings Personalizados, Estatísticas). Permite:
- Aplicar (carrega os valores nos filtros atuais).
- Guardar atual (snapshot do estado dos filtros).
- Editar, duplicar, eliminar.

Modelo é o mesmo independentemente da página — só muda a entidade.

---

## 6. Evolução do Ranking

Novo componente `RankingEvolutionSection` em todos os perfis (clube, jogador, competição, país).

Calcula posição da entidade em cada época usando `applySeasonView` com `seasonScope="only"` e selecionando o ranking apropriado consoante a entidade. Resultado:
- Tabela com Época / Posição / Variação vs ano anterior (↑↓ + número).
- Melhor / pior posição histórica.
- Nº épocas analisadas.
- Gráfico de linhas com Y invertido (1.º no topo).

Controlos por cima do gráfico:
- Categoria: Unificado / SuperLeague / Nacional / Continental / Internacional.
- Modo: Ponderado / Bruto.
- Decaimento: Com / Sem.

Estado controlado e persistido por entidade em `fm:evolution-prefs`.

Para jogadores (sem ranking direto), usa posição em "Jogadores" da página Rankings com a mesma métrica de pontos ponderada já existente.

---

## 7. Exportação / Importação Global JSON (atualização)

Reescrever `fm-global-backup.ts` para listar TODAS as chaves `fm:*` em `localStorage` que sejam de configuração — e ignorar chaves que armazenem dados importados.

Estrutura do JSON:
```
{
  schemaVersion: 2,
  exportedAt: "...",
  app: "FM World Rankings",
  buckets: {
    "ranking-weights": { ... },
    "weight-suggestions": { ... },
    "competition-reputation-manual": { ... },
    "custom-rankings": [...],
    "custom-formulas": [...],
    "saved-filters": [...],
    "evolution-prefs": {...},
    "ui-prefs": { theme, rankings-ui-version, ... },
    "club-reputation-aliases": {...},
    "country-aliases": {...},
    "continent-overrides": {...}
  }
}
```

Exclui explicitamente qualquer chave em allowlist negativa (dados importados, snapshots de insights, cache).

Importação: faz merge bucket-a-bucket; se `schemaVersion` for inferior, aplica migrações declaradas em `BACKUP_MIGRATIONS`. Mostra resumo (X rankings, Y fórmulas, Z filtros restaurados) antes de gravar.

Botões já existentes em `/configuracao` passam a usar a nova versão.

---

## Detalhes técnicos

**Localização de ficheiros novos**
```text
src/lib/
  fm-custom-rankings.ts       store + tipos
  fm-custom-formulas.ts       parser/AST + store
  fm-formula-evaluator.ts     runtime de avaliação
  fm-insights.ts              snapshots + cálculo de insights
  fm-saved-filters.ts         store
  fm-ranking-evolution.ts     cálculo da posição por época
  fm-global-backup.ts         (reescrito)

src/components/
  EntityFilterPanel.tsx       filtros partilhados
  DrillCell.tsx               célula clicável -> DrillDialog
  CustomRankingEditor.tsx     diálogo de criação/edição
  FormulaEditor.tsx           editor com validação ao vivo
  FormulaColumnPicker.tsx     selector de colunas extra
  SavedFiltersMenu.tsx        popover guardar/aplicar
  RankingEvolutionSection.tsx perfis

src/routes/
  rankings-personalizados.tsx
  rankings-personalizados.$id.tsx (executor)
  formulas-personalizadas.tsx
  insights.tsx
```

**Parser de fórmulas**: tokens (números, identificadores, operadores `+ - * / ( ) ,`), parser Pratt para precedência. Sem `Function`/`eval`. Funções permitidas: `min, max, abs, round, floor, ceil`. Variáveis resolvidas via dicionário fornecido pelo runtime (chaves em UPPERCASE sem acentos).

**Sem alterações ao backend**: nada é persistido em Supabase. Tudo em `localStorage` versionado.

**Compatibilidade do backup**: `schemaVersion` no topo, leitor aceita v1 (chaves achatadas atuais) e v2 (estrutura por buckets) — converte v1→v2 em memória.

---

## Ordem de entrega sugerida

1. Parser de fórmulas + store (§2) — base para §1 e colunas extras.
2. EntityFilterPanel partilhado + Rankings Personalizados (§1).
3. Filtros Guardados (§5) — usa o mesmo painel.
4. Drill-Down Universal (§4) — wrap de componentes existentes.
5. Evolução do Ranking (§6).
6. Insights (§3) — depende de hook de pós-importação.
7. Backup JSON v2 (§7) — incorpora tudo o que ficou acima.

Cada bloco fica funcional isoladamente e adiciona-se ao menu lateral à medida que entra.
