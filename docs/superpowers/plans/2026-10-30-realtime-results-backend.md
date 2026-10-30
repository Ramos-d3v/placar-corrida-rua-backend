# Backend de Resultados em Tempo Real — Plano de Implementação

> **Para agentes de implementação:** execute este plano com `@subagent-driven-development` (se houver subagentes disponíveis) ou `@executing-plans`. Marque cada tarefa somente após implementar e validar o comportamento descrito.

**Objetivo:** entregar um backend de resultados de corrida que o frontend possa consultar inicialmente por REST e manter sincronizado em tempo real por Socket.IO, sem polling e sem depender de conhecimento implícito da implementação atual.

**Arquitetura:** o PostgreSQL/Neon é a fonte de verdade. A ingestão autenticada entra em uma fila em memória, substitui evento/resultados em uma transação Prisma e, somente após o commit, atualiza um estado em memória e publica `results.updated` na sala do evento. O frontend faz uma leitura REST inicial, assina o evento pelo Socket.IO e usa os eventos somente como gatilho/dados de sincronização; após reconexão, deve buscar novamente o REST.

**Stack:** Node.js ESM, Express 5, Prisma 6, PostgreSQL/Neon, Zod, Socket.IO 4, `node:test`, ESLint 9 e Swagger/OpenAPI 3.0.

**Escopo:** contrato REST, contrato Socket.IO, ingestão de lotes, persistência atômica, reconexão, testes e documentação para o agente do frontend.

**Fora do escopo:** autenticação de usuários finais, múltiplos eventos persistidos simultaneamente, edição individual de atleta e notificações push fora do navegador.

---

## Contexto verificado

- O schema atual possui `events` e `results`, com um único evento ativo substituído por importação.
- `POST /api/ingest/results` já é a entrada recomendada para atualização externa e exige `X-Ingestion-API-Key`.
- `POST /api/results` e `POST /api/results/reset` são rotas destrutivas públicas legadas; não devem ser usadas pelo frontend em produção.
- O Socket.IO já expõe `subscribe`, `results.snapshot`, `results.pending`, `results.updated` e `results.reset`.
- O estado Socket.IO é em memória. Portanto, o frontend deve sempre obter o estado atual por REST após conectar/reconectar; o socket não é persistência.
- A especificação existente em [`docs/superpowers/specs/2026-10-18-results-payload-design.md`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/docs/superpowers/specs/2026-10-18-results-payload-design.md) exige payload de entrada snake_case, preservação do `event_slug` e envelopes estáveis.
- Há alterações não relacionadas já pendentes na pasta `postman/`; não revertê-las nem incluí-las neste trabalho.

## Requisitos

- **REQ-001 (P1):** o frontend deve conseguir carregar evento, paginação, filtros e resultados por REST.
- **REQ-002 (P1):** o frontend deve conseguir assinar um evento por `event_slug` e receber snapshot, atualização, pendência e reset.
- **REQ-003 (P1):** cada importação válida deve ser atômica e publicar atualização somente depois do commit no banco.
- **REQ-004 (P1):** o contrato de dados público deve usar snake_case e preservar valores nulos e strings exatamente como recebidos.
- **REQ-005 (P1):** reconexão, duplicação de eventos e atualização sem mudança não podem deixar o estado visual inconsistente.
- **REQ-006 (P1):** erros de validação, autorização, fila cheia e banco devem ter respostas distinguíveis.
- **REQ-007 (P2):** OpenAPI e testes devem documentar/verificar o contrato REST e realtime.

## Decisões de contrato para o frontend

### REST

Base URL: o mesmo origin do frontend em desenvolvimento (`http://localhost:3001`), configurável em produção.

`GET /api/results?page=1&limit=50&gender=&category=&search=` retorna:

```json
{
  "event": {
    "event_title": "Corrida de Demonstração",
    "event_slug": "corrida-de-demonstracao",
    "total_results": 116,
    "imported_at": "2026-10-30T12:00:00.000Z"
  },
  "pagination": { "page": 1, "limit": 50, "total": 116 },
  "results": [{
    "id": "uuid",
    "bib_number": "1817",
    "athlete_name": "Atleta",
    "category": "C",
    "status": "Finished",
    "gender": "MASCULINO",
    "rank_general": 1,
    "rank_category": null,
    "time_gross": "00:15:45.480",
    "time_net": "00:15:43.020",
    "team_name": null
  }]
}
```

Quando não houver evento: `event: null`, `pagination.total: 0` e `results: []`.

`GET /api/results/:bibNumber` retorna `{ event, result }` ou `404 { error: "Resultado não encontrado" }`.

`GET /health` retorna `{ status: "ok" }`.

`POST /api/ingest/results` é somente para o produtor de resultados, com `X-Ingestion-API-Key`, e retorna `202`:

```json
{
  "accepted": true,
  "changed": null,
  "event_slug": "corrida-de-demonstracao",
  "request_id": "uuid",
  "queue_position": 1
}
```

Erros síncronos esperados: `401` chave inválida, `422` payload inválido, `503` fila cheia e `413` corpo acima de 10 MB. Uma ingestão aceita sempre retorna `202`; falhas posteriores de banco não podem mudar essa resposta e devem ser observáveis por logs/métrica/health operacional. `500` aplica-se às rotas síncronas legadas (`POST /api/results`).

### Socket.IO

Conectar ao mesmo origin da API, sem namespace customizado:

```ts
const socket = io(API_URL, { transports: ["websocket", "polling"] });
```

Assinar (inclusive quando `event_slug` for a string vazia):

```ts
socket.emit("subscribe", { event_slug: slug }, (ack) => { /* tratar ack */ });
```

Ack de evento existente:

```json
{
  "subscribed": true,
  "room": "results:corrida-de-demonstracao",
  "state": {
    "event_slug": "corrida-de-demonstracao",
    "version": "sha256",
    "updated_at": "2026-10-30T12:00:00.000Z",
    "payload": {
      "event": {
        "event_title": "Corrida de Demonstração",
        "event_slug": "corrida-de-demonstracao",
        "total_results": 116,
        "imported_at": "2026-10-30T12:00:00.000Z"
      },
      "results": [],
      "imported_count": 116
    }
  }
}
```

Eventos:

| Evento | Direção | Significado | Ação do frontend |
|---|---|---|---|
| `results.snapshot` | servidor → cliente | estado cacheado entregue ao assinar | renderizar/mesclar snapshot e manter REST como fonte de detalhes paginados |
| `results.pending` | servidor → cliente | ainda não há estado realtime para o slug | manter estado vazio/loading e aguardar `results.updated` |
| `results.updated` | servidor → sala | novo lote persistido | aceitar apenas se `version` for diferente; atualizar dados e refazer GET paginado |
| `results.reset` | servidor → todos | dados removidos | limpar cache local e refazer `GET /api/results` |
| `connect`/`disconnect`/`connect_error` | Socket.IO | ciclo de conexão | mostrar estado de conexão; após `connect`, refazer GET e `subscribe` |

O nome da sala é sempre `results:${event_slug}`; portanto, para slug vazio, a sala é `results:`. Como há apenas um evento ativo, isso não cria ambiguidade. O frontend não deve chamar `POST /api/results` nem `POST /api/results/reset`. Essas rotas permanecem apenas por compatibilidade/admin local.

## Constituição/checklist de qualidade

- **Fonte de verdade:** toda publicação realtime acontece após a transação Prisma concluir.
- **Contrato explícito:** tipos, envelopes, eventos, códigos HTTP e exemplos ficam documentados no OpenAPI e nos testes.
- **Falhas visíveis:** não esconder erros de banco, fila ou validação; não emitir `results.updated` em falha.
- **Compatibilidade:** preservar filtros, paginação, limite de 10 MB, CORS e rotas já existentes.
- **Segurança:** somente ingestão externa usa chave; o frontend recebe dados públicos sem CPF ou campos desconhecidos.

## Etapas de implementação

### Fase 1 — Contrato e modelo público

#### P1.1 — Canonicalizar o envelope público do evento `[REQ-001, REQ-004]`

Atualizar [`src/services/results.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/services/results.js) e [`src/schemas/results.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/schemas/results.js) para retornar `event_title` e `event_slug` nos dois endpoints REST, mantendo `results` em snake_case. Preservar `null`, ordenação, filtros, paginação e `imported_at` ISO.

#### P1.2 — Alinhar validação ao payload real `[REQ-004]`

Aceitar o payload de [`Payload_2026-10-18T1256 (1).json`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/Payload_2026-10-18T1256%20%281%29.json), incluindo 116 resultados, `MASCULINO`/`FEMININO`, `C`/`L`, `rank_category: null` e valores opcionais nulos. Validar comprimento sem transformar o valor: remover `.trim()` dos campos persistidos e usar refinements para rejeitar strings vazias/longas nos campos obrigatórios; a exceção é `event_slug`, que pode ser exatamente `""`. Não derivar slug do título.

#### P1.3 — Definir tipos compartilháveis do contrato `[REQ-001, REQ-002, REQ-004]`

Criar um documento de contrato em [`docs/api/realtime-contract.md`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/docs/api/realtime-contract.md) com os tipos TypeScript equivalentes, exemplos JSON, tabela de eventos e regras de reconexão acima. Não duplicar regra de negócio em TypeScript no backend; o documento serve para o agente frontend.

### Fase 2 — Persistência e publicação realtime

#### P2.1 — Garantir ordem banco → estado → evento `[REQ-003, REQ-005]`

Revisar [`src/services/ingestion.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/services/ingestion.js): validar antes de enfileirar, executar `replaceEventResults`, atualizar `realtimeState` somente após sucesso e publicar `results.updated` com `version`, `updated_at`, evento público e `imported_count`. Falha de banco deve permanecer como falha de job e nunca retornar sucesso ao produtor.

#### P2.2 — Tornar o snapshot consistente com REST `[REQ-002, REQ-004]`

Fazer o estado realtime armazenar exatamente `{ event, results, imported_count }`, onde `event` usa `event_title`, `event_slug`, `total_results`, `imported_at` e cada item de `results` passa por `toPublicResult` (incluindo `id`). `results.snapshot` e `results.updated` usam o mesmo estado externo `{ event_slug, version, updated_at, payload }`; o exemplo canônico acima é normativo. O `payload` contém o lote completo; o frontend ainda refaz GET para respeitar paginação/filtros.

#### P2.3 — Corrigir reset e estado obsoleto `[REQ-003, REQ-005]`

Em [`src/services/ingestion.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/services/ingestion.js), limpar o estado somente depois do reset transacional. Publicar `results.reset` apenas quando a transação terminar; garantir que reset não produza snapshot antigo para novas assinaturas.

### Fase 3 — Socket.IO e comportamento de conexão

#### P3.1 — Formalizar assinatura e validação `[REQ-002, REQ-006]`

Revisar [`src/realtime/socket.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/realtime/socket.js): aceitar qualquer string de `event_slug`, inclusive vazia, rejeitar apenas tipo ausente/não-string ou comprimento acima do limite, retornar ack de erro determinístico, entrar somente na sala correspondente e emitir exatamente `results.snapshot` ou `results.pending`. Não transmitir atualizações de um slug a outra sala.

#### P3.2 — Definir semântica de versão/idempotência `[REQ-005]`

Usar `version` SHA-256 do payload canônico como identificador idempotente. O frontend deve ignorar a mesma versão; o backend deve evitar publicar quando o lote recebido não mudou. Documentar que `updated_at` não é critério confiável de ordenação entre conexões.

#### P3.3 — Configurar CORS e encerramento `[REQ-002, REQ-006]`

Garantir que HTTP e Socket.IO usem a mesma lista `FRONTEND_ORIGINS`, que `close()` remova listeners do publisher e que SIGINT/SIGTERM fechem fila, socket, HTTP e Prisma. Validar ambiente inválido em [`src/config/env.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/config/env.js).

### Fase 4 — REST/OpenAPI e observabilidade

#### P4.1 — Atualizar OpenAPI `[REQ-001, REQ-006, REQ-007]`

Atualizar [`src/docs/openapi.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/src/docs/openapi.js) para os nomes públicos finais, exemplos de erro, `202` da ingestão e uma seção de protocolo Socket.IO. Explicitar que a importação substitui o evento atual e que o frontend não usa as rotas destrutivas.

#### P4.2 — Adicionar identificação operacional `[REQ-003, REQ-006]`

Gerar `request_id` antes de enfileirar e armazenar o job como `{ request_id, payload }`, preservando-o durante o processamento. Incluir `request_id`, `event_slug` e versão quando disponível nos logs de processamento/falha, sem registrar payload completo ou dados pessoais. A rota autenticada continua retornando `202` e não promete falha de banco síncrona; `500` aplica-se às rotas síncronas legadas (`POST /api/results`). Falha assíncrona deve ser observável no log e em métrica/health operacional, sem fingir sucesso do job.

### Fase 5 — Testes e validação end-to-end

#### P5.1 — Testar schema e mapeamento `[REQ-004]`

Expandir [`test/results-schema.test.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/test/results-schema.test.js) para o arquivo real [`Payload_2026-10-18T1256 (1).json`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/Payload_2026-10-18T1256%20%281%29.json), slug vazio, preservação de espaços internos/externos conforme a decisão de contrato, 116 itens, nulos e remoção de campos desconhecidos.

#### P5.2 — Testar persistência e rotas `[REQ-001, REQ-003, REQ-006]`

Adicionar testes de serviço/HTTP para importação atômica, substituição de evento, envelopes snake_case, paginação, filtros, busca por bib, `404`, `health`, reset e respostas `422/503/500`. Usar banco de teste isolado; não alterar dados de produção.

#### P5.3 — Testar realtime `[REQ-002, REQ-005]`

Expandir [`test/realtime-socket.test.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/test/realtime-socket.test.js) para snapshot, pending, isolamento de salas, update, reset, ack inválido e reconexão. Expandir [`test/realtime-state.test.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/test/realtime-state.test.js) para versões idempotentes e payload canônico.

#### P5.4 — Testar fila e documentação `[REQ-003, REQ-006, REQ-007]`

Manter/expandir [`test/ingestion-queue.test.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/test/ingestion-queue.test.js), [`test/ingestion-auth.test.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/test/ingestion-auth.test.js) e [`test/openapi.test.js`](C:/Users/enzoc/Desktop/projetos/placar-corrida-rua-backend/test/openapi.test.js). Rodar `npm test` e `npm run lint`.

#### P5.5 — Validar fluxo real `[REQ-001, REQ-002, REQ-003, REQ-007]`

Subir API local, importar o JSON real pela rota autenticada, conectar cliente Socket.IO, assinar o slug, confirmar snapshot/update, consultar todas as páginas e comparar campos. Confirmar `imported_count: 116`, saúde da API e ausência de vazamento de campos desconhecidos.

## Lista de tarefas executáveis

### Fase 1

- [ ] T001 [P] [Plan:1.1] Atualizar `src/schemas/results.js` com tipos/mapeadores públicos snake_case para evento e resultado.
- [ ] T002 [P] [Plan:1.2] Adicionar fixture/teste do payload real em `test/results-schema.test.js`, cobrindo 116 resultados, nulos e valores de gênero/categoria.
- [ ] T003 [Plan:1.2] Ajustar `src/schemas/results.js` para permitir `event_slug` vazio e preservar strings originais, validando vazio/comprimento sem `.trim()` no valor armazenado.
- [ ] T004 [Plan:1.1] Atualizar `src/services/results.js` e testes de rota para validar os envelopes REST finais.
- [ ] T005 [P] [Plan:1.3] Criar `docs/api/realtime-contract.md` com tipos, exemplos, eventos e regras de reconexão para o frontend.

### Fase 2

- [ ] T006 [Plan:2.1] Ajustar `src/services/ingestion.js` para publicar somente após commit transacional, comparar a versão/hash antes do banco e manter resposta idempotente/no-op quando o lote não mudar.
- [ ] T007 [Plan:2.2] Normalizar em `src/services/ingestion.js` o estado realtime para `{ event, results, imported_count }`, usando `toPublicResult`, e armazená-lo via `src/services/realtime-state.js`.
- [ ] T008 [Plan:2.3] Corrigir reset em `src/services/ingestion.js` para limpar estado/publicar evento somente após sucesso do banco.
- [ ] T009 [Plan:2.1,2.2,2.3] Criar testes de falha transacional garantindo ausência de `results.updated` em erro e ausência de snapshot após reset.

### Fase 3

- [ ] T010 [Plan:3.1] Atualizar `src/realtime/socket.js` para aceitar slug vazio, rejeitar apenas tipo/limite inválido, retornar ack de erro, isolar salas e emitir o envelope canônico documentado.
- [ ] T011 [Plan:3.2] Cobrir deduplicação por `version` em `test/realtime-state.test.js` e `test/realtime-socket.test.js`.
- [ ] T012 [Plan:3.3] Validar CORS compartilhado e encerramento em `src/realtime/socket.js`, `src/server.js` e `src/config/env.js`.

### Fase 4

- [ ] T013 [Plan:4.1] Atualizar schemas, exemplos, status e descrição Socket.IO em `src/docs/openapi.js`.
- [ ] T014 [Plan:4.2] Alterar `src/routes/ingestion.js` e `src/services/ingestion-queue.js` para transportar `request_id` no job, registrar falhas assíncronas com `request_id`/`event_slug` e manter contador/health operacional de jobs falhos, sem payload pessoal.
- [ ] T015 [Plan:4.1] Atualizar `test/openapi.test.js` para verificar todas as rotas, snake_case, `202`, erros e protocolo realtime.

### Fase 5

- [ ] T016 [P] [Plan:5.1] Executar teste de compatibilidade do arquivo `Payload_2026-10-18T1256 (1).json` e ajustar somente validações incompatíveis; cobrir preservação literal de strings.
- [ ] T017 [P] [Plan:5.2] Criar `test/results-service.test.js` e/ou `test/results-http.test.js` com banco isolado para importação, paginação, filtros, bib desconhecido, reset e health; distinguir o `202` assíncrono da ingestão dos `500` síncronos legados.
- [ ] T018 [P] [Plan:5.3] Completar testes Socket.IO de snapshot, pending, update, reset, erro e isolamento de salas.
- [ ] T019 [Plan:5.4] Rodar `npm test` e `npm run lint`; corrigir falhas introduzidas pelo contrato final e validar o contador/health de falha assíncrona.
- [ ] T020 [Plan:5.5] Executar validação manual end-to-end com `npm run dev`, importação autenticada e cliente Socket.IO; registrar resultado no pull request.

## Guia de implementação para o agente frontend

1. Ao abrir a tela, executar `GET /api/results?page=1&limit=50` e renderizar `event`, `pagination` e `results`.
2. Se houver evento, conectar Socket.IO e emitir `subscribe` com o `event_slug` retornado pelo REST.
3. Em `results.snapshot`, aceitar a versão se ainda não estiver no cache e atualizar o estado; para filtros/paginação, refazer o GET.
4. Em `results.pending`, manter a tela vazia/loading sem considerar isso como erro.
5. Em `results.updated`, comparar `version`, atualizar o indicador de última atualização e refazer o GET da página/filtro atual. Não duplicar itens aplicando o lote sobre uma lista antiga.
6. Em `results.reset`, limpar a tabela, zerar paginação e refazer o GET.
7. Em `disconnect`/`connect_error`, exibir estado offline sem apagar os últimos dados; em `connect`, refazer GET e `subscribe`.
8. Nunca enviar `INGESTION_API_KEY` para o navegador. O produtor de resultados chama `/api/ingest/results`; o frontend é consumidor público.
9. Tratar `401`, `422`, `503`, `413` e `500` separadamente para mensagens e retry apropriados.

## Critérios de aceite

- [ ] Uma importação válida substitui o evento de forma atômica e só então emite `results.updated`.
- [ ] Dois clientes em slugs distintos não recebem atualizações cruzadas.
- [ ] Um cliente que conecta depois de uma importação recebe snapshot ou consegue reconstruir o estado pelo REST.
- [ ] Reconexão nunca deixa o frontend permanentemente com dados antigos.
- [ ] O contrato público não expõe CPF ou campos desconhecidos.
- [ ] O payload real de 116 resultados é aceito e pode ser lido por todas as páginas.
- [ ] `npm test` e `npm run lint` passam.

## Mapeamento de requisitos

| ID | Descrição | Itens do plano | Evidência |
|---|---|---|---|
| REQ-001 | Consulta REST de resultados | P1.1, P4.1, P5.2, P5.5 | `src/services/results.js`, `src/docs/openapi.js`, testes HTTP |
| REQ-002 | Assinatura e eventos realtime | P2.2, P3.1, P5.3, P5.5 | `src/realtime/socket.js`, contrato realtime, testes Socket.IO |
| REQ-003 | Importação atômica e publicação pós-commit | P2.1, P2.3, P5.2, P5.5 | `src/services/ingestion.js`, `src/services/results.js`, testes transacionais |
| REQ-004 | Snake_case, nulos e compatibilidade de payload | P1.1, P1.2, P1.3, P5.1 | `src/schemas/results.js`, fixture real, contrato |
| REQ-005 | Idempotência e reconexão segura | P2.1, P3.2, P5.3 | `src/services/realtime-state.js`, testes de versão |
| REQ-006 | Erros e configuração explícitos | P3.1, P3.3, P4.2, P5.4 | `src/app.js`, `src/config/env.js`, OpenAPI e testes |
| REQ-007 | Documentação e validação | P1.3, P4.1, P5.4, P5.5 | `docs/api/realtime-contract.md`, OpenAPI, suíte de testes |

## Traceabilidade plan-to-task

| Item | Tarefas |
|---|---|
| P1.1 | T001, T004 |
| P1.2 | T002, T003 |
| P1.3 | T005 |
| P2.1 | T006, T009 |
| P2.2 | T007, T009 |
| P2.3 | T008, T009 |
| P3.1 | T010 |
| P3.2 | T011 |
| P3.3 | T012 |
| P4.1 | T013, T015 |
| P4.2 | T014 |
| P5.1 | T016 |
| P5.2 | T017 |
| P5.3 | T018 |
| P5.4 | T019 |
| P5.5 | T020 |

## Riscos e decisões pendentes

- **Slug vazio:** o contrato aceita string vazia e a sala correspondente é `results:`. O backend não deriva slug; o frontend assina exatamente o valor devolvido pelo REST.
- **Fila em memória:** `POST /api/ingest/results` é aceito antes do processamento e pode perder jobs durante reinício. Operar uma única instância até existir fila durável; registrar falhas e expor métrica/health operacional antes de escalar.
- **Estado em memória:** com mais de uma instância da API, eventos não são compartilhados entre processos. Antes de escalar horizontalmente, trocar o publisher por Redis/socket adapter ou outro broker; não mascarar esse risco no frontend.
- **Lote completo no socket:** 50.000 resultados pode exceder o tamanho desejável de uma mensagem. Para produção em lotes grandes, preferir evento leve `{ version, event }` seguido de GET; manter snapshot completo apenas se o limite operacional for validado.
