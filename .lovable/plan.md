# Plano de Reorganização Global — Bloco 3

Trabalho em **fases**, começando pelo módulo **Rankings**. Cada fase é confirmada antes de avançar para a próxima. Toda a lógica de pontos, pesos, desafios e importação é preservada — o foco é UX, consistência e novas features específicas.

---

## Princípios transversais (aplicados a todas as páginas)

1. **Entidades clicáveis** — jogador, treinador, clube, país, competição, continente ligam sempre ao respetivo perfil. Auditar tabelas e cards que ainda mostram texto puro.
2. **Tabelas configuráveis** — colunas com resize + toggle mostrar/esconder, persistido em `localStorage` por tabela (nova hook `useTableColumnPrefs`).
3. **Sidebar em 3 grandes categorias** — `Import`, `Rankings`, `Scores`. Rankings/Scores expandem para submenus. Reorganizar `AppShell.tsx` mantendo o customize dialog.
4. **Barra de pesquisa global** — já existe (`GlobalSearch`); rever para incluir competições e continentes com autofill instantâneo.
5. **Performance de importação/pesquisa** — pré-indexar jogadores por nome (Map em memória + índice IDU), lazy-load das tabs pesadas.

---

## FASE 1 — Módulo Rankings (arranque)

### 1.1 Página `Rankings Mundiais` (`src/routes/rankings.tsx`)
- Manter toda a lógica de cálculo (`useRankings`, pesos, desafios).
- **Reorganizar layout**: header compacto com filtros primários (época, entidade, país), painel lateral colapsável para filtros avançados, área principal só com a tabela + tabs.
- **Remover coluna Domínio** da tabela (a página `/dominio` mantém-se).
- **Nova coluna Δ por época**: em vez de uma coluna única "Δ vs anterior", cada célula de época mostra a variação de posição (▲3 / ▼2) e de pontos vs época anterior (ou vs época anterior no filtro ativo). Implementar em `SeasonsRankTable.tsx` via prop `showDelta`.
- **Filtros avançados melhorados**: agrupar por secções (Época, Geografia, Competição, Métrica), com chips ativos visíveis no topo.

### 1.2 Página `Histórico de Rankings` (`src/routes/ranking-historico.tsx`)
- Reorganizar com o **mesmo formato de tabs/tabelas/toggles** da página Rankings Mundiais.
- Mostrar a posição global (pontos acumulados) de cada entidade em cada época — não a posição isolada dessa época.

### 1.3 Página `Hall of Fame` (`src/routes/hall-of-fame.tsx`)
- Uniformizar todas as tabelas ao mesmo componente base (`SeasonsRankTable`/wrapper).
- Simplificar navegação entre categorias.

### 1.4 Página `Análise Estatística` + `Estatísticas Agregadas` (`src/routes/analise.tsx`, `estatisticas.tsx`)
- Manter toda a informação, remodelar visualização: cards de destaques no topo, gráficos principais em grid, tabelas detalhadas em accordions.

### 1.5 Página `Domínio` (`src/routes/dominio.tsx`)
- Manter clubes + treinadores (já feito).
- **Adicionar Países e Jogadores** com a mesma lógica de janelas de N épocas.

### 1.6 Página `Treinador por País`
- Integrar como **tab dentro de Rankings Mundiais** em vez de página autónoma, mantendo todas as funcionalidades.

---

## FASE 2 — Configuração
- Reorganizar `src/routes/configuracao.tsx` com sidebar interna (Pesos globais, Pesos por competição, Pesos por fase, Perfis).
- **Remover** secções: "Competições continentais que contam para Triplete / Dobradinha Internacional / Quadruple / Club World Cup" (passa a ser feito via Desafios).
- **Refactor Pesos por fase eliminatória** para percentagens: `final = 50%`, `meias = 22%`, etc. — percentagens aplicadas sobre os pontos do vencedor. Migração dos perfis existentes.
- **Perfis**: reorganizar como uma **tab** dentro da nova página de perfil da app.
- Manter export/import JSON e backup global.

---

## FASE 3 — Desafios & Dashboard
- `Desafios`: sem alterações lógicas.
- `Dashboard de Desafios`: reorganizar filtros e cards para leitura rápida.

---

## FASE 4 — Import (revisitar)
- Confirmar: remoção individual ✅, log com data+época+ficheiro ✅.
- **Adicionar por import**: página resumo com estatísticas (nº entidades novas/atualizadas, avisos), barra de pesquisa por nome/data/época.
- Avisos não bloqueantes (toast + coluna "avisos" no histórico).

---

## FASE 5 — Manter sem alterações
- Insights, páginas Debug, Fórmulas personalizadas, Filtros guardados, Sugestão de Pesos.

---

## Dúvida sobre IDs internos
Recomendo **não** criar IDs internos: o IDU do FM é estável e único, e adicionar um segundo ID complica joins e imports. Uso o IDU como chave primária para jogadores/treinadores. Confirmar.

---

## Ordem de execução proposta
1. **Fase 1.1 (Rankings Mundiais reorganizado + Δ por época + remoção Domínio)** — arranco por aqui.
2. Confirmação → 1.2 Histórico.
3. Confirmação → 1.3 Hall of Fame.
4. …e assim sucessivamente.

Confirmas o arranque pela **Fase 1.1**?
