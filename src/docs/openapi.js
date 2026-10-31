const exampleResult = {
  id: '00000000-0000-4000-8000-000000000001',
  bib_number: '1001',
  athlete_name: 'Ana Silva',
  category: 'Adulto 25-34',
  status: 'Concluído',
  gender: 'Feminino',
  rank_general: 1,
  rank_category: 1,
  time_gross: '00:32:14.250',
  time_net: '00:32:10.800',
  team_name: 'Equipe Horizonte',
  pace: '3:44 min/km',
};

const exampleUpdateAthlete = {
  athlete_name: 'Ana Silva Santos',
  category: 'Adulto 25-34',
  status: 'Concluído',
  gender: 'Feminino',
  rank_general: 1,
  rank_category: 1,
  time_gross: '00:32:10.150',
  time_net: '00:32:08.500',
  team_name: 'Equipe Horizonte Pro',
  pace: '4:10 min/km',
};

const exampleImport = {
  event_title: 'Corrida de Demonstração',
  event_slug: 'corrida-de-demonstracao',
  total_results: 1,
  results: [{
    bib_number: '1001',
    athlete_name: 'Ana Silva',
    category: 'Adulto 25-34',
    status: 'Concluído',
    gender: 'Feminino',
    rank_general: 1,
    rank_category: 1,
    time_gross: '00:32:14.250',
    time_net: '00:32:10.800',
    team_name: 'Equipe Horizonte',
    pace: '3:44 min/km',
  }],
};

const eventExample = {
  title: 'Corrida de Demonstração',
  slug: 'corrida-de-demonstracao',
  total_results: 1,
  imported_at: '2026-10-13T17:00:00.000Z',
};

const validationErrorExample = {
  error: 'Payload ou parâmetros inválidos',
  details: [{
    code: 'custom',
    path: ['total_results'],
    message: 'total_results deve corresponder à quantidade de itens em results',
  }],
};

const queryValidationErrorExample = {
  error: 'Payload ou parâmetros inválidos',
  details: [{
    code: 'too_big',
    path: ['limit'],
    message: 'Number must be less than or equal to 100',
  }],
};

const errorResponse = {
  description: 'Resposta de erro da API.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const rateLimitResponse = {
  description: 'Limite de requisições excedido: 120 por minuto.',
  content: {
    'text/html': {
      schema: { type: 'string' },
      example: 'Too many requests, please try again later.',
    },
  },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'API de Resultados de Corrida',
    version: '1.0.0',
    description: [
      'API para importar, atualizar e consultar resultados de corridas de rua em tempo real.',
      '',
      '**Destaques de Operação e Persistência:**',
      '- `POST /api/results`: Ingestão incremental via upsert (insere novos corredores e atualiza corredores existentes sem apagar o banco).',
      '- `PUT /api/results/{bibNumber}`: Altera pontualmente os dados de um atleta específico por número de peito.',
      '- `POST /api/results/reset`: **Única rota destrutiva**. Remove todos os eventos e resultados do banco.',
      '- `GET /api/results`: Consulta paginada dos resultados com filtros por gênero, categoria e busca textual.',
      '- `GET /api/results/{bibNumber}`: Consulta individual por número de peito.',
      '- `POST /api/ingest/results`: Recepção assíncrona autenticada via fila para servidores externos de cronometragem.',
    ].join('\n'),
  },
  servers: [{
    url: '/',
    description: 'Mesmo host em que a documentação está aberta',
  }],
  tags: [
    { name: 'Status', description: 'Verificação da disponibilidade da API.' },
    { name: 'Resultados', description: 'Importação, limpeza e consulta dos resultados.' },
    { name: 'Ingestão', description: 'Recepção autenticada de atualizações externas.' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Status'],
        summary: 'Verificar se a API está funcionando',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'API disponível.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string', example: 'ok' } },
                },
                example: { status: 'ok' },
              },
            },
          },
        },
      },
    },
    '/api/results': {
      post: {
        tags: ['Resultados'],
        summary: 'Importar os resultados de uma corrida',
        operationId: 'importResults',
        description: [
          'Importa ou atualiza os resultados de uma corrida via upsert incremental.',
          '',
          '**Esta rota é pública e não exige credencial.** Realiza ingestão incremental:',
          'insere novos participantes e substitui/atualiza dados dos participantes existentes pelo número de peito.',
          '**Não apaga os dados existentes do banco**, evitando sobrecarga no sistema.',
          '`total_results` deve corresponder à quantidade de itens em `results`.',
          'O lote aceita até 50.000 participantes e o corpo da requisição até 10 MB.',
        ].join('\n'),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ImportResultsRequest' },
              example: exampleImport,
            },
          },
        },
        responses: {
          200: {
            description: 'Evento importado e dados atuais substituídos.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ImportResultsResponse' },
                example: {
                  event: eventExample,
                  imported_count: 1,
                },
              },
            },
          },
          413: {
            description: 'O corpo excede o limite de 10 MB.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Payload excede o limite de 10 MB' },
              },
            },
          },
          422: {
            description: 'JSON válido, mas payload ou campos não passaram na validação.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
                example: validationErrorExample,
              },
            },
          },
          429: rateLimitResponse,
          500: { description: 'Erro interno ao processar a importação.', ...errorResponse },
        },
      },
      get: {
        tags: ['Resultados'],
        summary: 'Listar os resultados do evento atual',
        operationId: 'listResults',
        description: 'Retorna os resultados do evento atual, ordenados pela classificação geral e número de peito.',
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Número da página (começa em 1).',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Resultados por página (de 1 a 100).',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: 'gender',
            in: 'query',
            description: 'Filtrar pelo gênero informado nos resultados.',
            schema: { type: 'string', example: 'Feminino' },
          },
          {
            name: 'category',
            in: 'query',
            description: 'Filtrar pelo nome exato da categoria.',
            schema: { type: 'string', example: 'Adulto 25-34' },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Buscar pelo nome do atleta ou parte do número de peito.',
            schema: { type: 'string', maxLength: 100, example: 'Ana' },
          },
          {
            name: 'event_slug',
            in: 'query',
            description: 'Identificador do evento para consultar resultados específicos.',
            schema: { type: 'string', example: 'corrida' },
          },
        ],
        responses: {
          200: {
            description: 'Resultados encontrados ou lista vazia quando não há evento.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResultsListResponse' },
                examples: {
                  comResultados: {
                    summary: 'Evento atual com resultados',
                    value: {
                      event: eventExample,
                      pagination: { page: 1, limit: 50, total: 1 },
                      results: [exampleResult],
                    },
                  },
                  vazio: {
                    summary: 'Ainda não há evento importado',
                    value: {
                      event: null,
                      pagination: { page: 1, limit: 50, total: 0 },
                      results: [],
                    },
                  },
                },
              },
            },
          },
          422: {
            description: 'Parâmetros de consulta inválidos.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
                example: queryValidationErrorExample,
              },
            },
          },
          429: rateLimitResponse,
          500: { description: 'Erro interno ao consultar os resultados.', ...errorResponse },
        },
      },
    },
    '/api/ingest/results': {
      post: {
        tags: ['Ingestão'],
        summary: 'Receber uma atualização externa de resultados',
        operationId: 'ingestResults',
        description: [
          'Recebe um lote validado do servidor externo. ',
          'A autenticação usa o header `X-Ingestion-API-Key`. ',
          'Payloads idênticos ao último estado conhecido não geram nova publicação realtime.',
        ].join(''),
        security: [{ ingestionApiKey: [] }],
        parameters: [{
          name: 'X-Ingestion-API-Key',
          in: 'header',
          required: true,
          schema: { type: 'string' },
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ImportResultsRequest' },
              example: exampleImport,
            },
          },
        },
        responses: {
          202: {
            description: 'Payload validado e aceito pela fila de processamento.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IngestionAcceptedResponse' },
              },
            },
          },
          401: { description: 'API Key ausente ou inválida.', ...errorResponse },
          413: { description: 'O corpo excede o limite de 10 MB.', ...errorResponse },
          422: { description: 'Payload inválido.', ...errorResponse },
          503: { description: 'A fila de ingestão está sem capacidade.', ...errorResponse },
          429: rateLimitResponse,
          500: { description: 'Erro interno ao processar a ingestão.', ...errorResponse },
        },
      },
    },
    '/api/results/reset': {
      post: {
        tags: ['Resultados'],
        summary: 'Apagar todos os eventos e resultados',
        operationId: 'resetResults',
        description: [
          '**Ação destrutiva exclusiva:** remove todos os resultados e todos os eventos do banco.',
          '',
          'Esta rota é pública e não exige credencial. Não é necessário enviar corpo.',
          'Esta é a **única rota** que apaga dados do sistema; rotas de importação e alteração não realizam exclusão.',
          'A operação pode ser repetida; quando o banco já está vazio, as contagens retornam zero.',
        ].join('\n'),
        responses: {
          200: {
            description: 'Dados removidos; informa quantos registros foram excluídos.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResetResultsResponse' },
                examples: {
                  dadosRemovidos: {
                    summary: 'Um evento e três resultados removidos',
                    value: { deleted_results: 3, deleted_events: 1 },
                  },
                  bancoVazio: {
                    summary: 'Banco já estava vazio',
                    value: { deleted_results: 0, deleted_events: 0 },
                  },
                },
              },
            },
          },
          429: rateLimitResponse,
          500: { description: 'Erro interno ao apagar os dados.', ...errorResponse },
        },
      },
    },
    '/api/results/{bibNumber}': {
      get: {
        tags: ['Resultados'],
        summary: 'Consultar um participante pelo número de peito',
        operationId: 'getResultByBibNumber',
        parameters: [
          {
            name: 'bibNumber',
            in: 'path',
            required: true,
            description: 'Número de peito do participante.',
            schema: { type: 'string', example: '1001' },
          },
          {
            name: 'event_slug',
            in: 'query',
            description: 'Identificador do evento para consultar o participante específico.',
            schema: { type: 'string', example: 'corrida' },
          },
        ],
        responses: {
          200: {
            description: 'Participante encontrado no evento atual.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SingleResultResponse' },
                example: {
                  event: { title: eventExample.title, slug: eventExample.slug },
                  result: exampleResult,
                },
              },
            },
          },
          404: {
            description: 'Resultado não encontrado no evento atual.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Resultado não encontrado' },
              },
            },
          },
          429: rateLimitResponse,
          500: { description: 'Erro interno ao consultar o resultado.', ...errorResponse },
        },
      },
      put: {
        tags: ['Resultados'],
        summary: 'Atualizar os dados de um atleta específico',
        operationId: 'updateResultByBibNumber',
        description: [
          'Atualiza os dados de um atleta identificado pelo seu número de peito.',
          '',
          'Permite alterar nome, categoria, status, gênero, classificações (geral e categoria),',
          'tempos (bruto e líquido), equipe e pace. A alteração afeta apenas o atleta especificado,',
          'preservando todos os demais dados do banco de dados e notificando o placar ao vivo.',
        ].join('\n'),
        parameters: [{
          name: 'bibNumber',
          in: 'path',
          required: true,
          description: 'Número de peito do participante a ser atualizado.',
          schema: { type: 'string', example: '1001' },
        }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateResultRequest' },
              example: exampleUpdateAthlete,
            },
          },
        },
        responses: {
          200: {
            description: 'Participante atualizado com sucesso.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SingleResultResponse' },
                example: {
                  event: { title: eventExample.title, slug: eventExample.slug },
                  result: {
                    ...exampleResult,
                    ...exampleUpdateAthlete,
                  },
                },
              },
            },
          },
          404: {
            description: 'Resultado ou evento não encontrado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Resultado não encontrado' },
              },
            },
          },
          422: {
            description: 'Campos inválidos ou nenhum campo informado para alteração.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
                example: validationErrorExample,
              },
            },
          },
          429: rateLimitResponse,
          500: { description: 'Erro interno ao atualizar o resultado.', ...errorResponse },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ingestionApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Ingestion-API-Key',
      },
    },
    schemas: {
      ImportResultsRequest: {
        type: 'object',
        required: ['event_title', 'event_slug', 'total_results', 'results'],
        properties: {
          event_title: { type: 'string', minLength: 1, maxLength: 200, example: exampleImport.event_title },
          event_slug: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
            pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            example: exampleImport.event_slug,
          },
          total_results: { type: 'integer', minimum: 0, example: 1 },
          results: {
            type: 'array',
            maxItems: 50000,
            items: { $ref: '#/components/schemas/ImportedResult' },
          },
        },
      },
      UpdateResultRequest: {
        type: 'object',
        properties: {
          athlete_name: { type: 'string', minLength: 1, maxLength: 200, example: 'Ana Silva Santos' },
          category: { type: 'string', minLength: 1, maxLength: 80, example: 'Adulto 25-34' },
          status: { type: 'string', minLength: 1, maxLength: 40, example: 'Concluído' },
          gender: { type: 'string', minLength: 1, maxLength: 20, example: 'Feminino' },
          rank_general: { type: 'integer', minimum: 1, nullable: true, example: 1 },
          rank_category: { type: 'integer', minimum: 1, nullable: true, example: 1 },
          time_gross: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{2,}:\\d{2}:\\d{2}\\.\\d{3}$',
            example: '00:32:10.150',
          },
          time_net: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{2,}:\\d{2}:\\d{2}\\.\\d{3}$',
            example: '00:32:08.500',
          },
          team_name: { type: 'string', maxLength: 200, nullable: true, example: 'Equipe Horizonte Pro' },
          pace: { type: 'string', maxLength: 20, nullable: true, example: '4:10 min/km' },
          event_slug: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
            pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            example: 'corrida-de-demonstracao',
          },
        },
        example: exampleUpdateAthlete,
      },
      ImportedResult: {
        type: 'object',
        required: ['bib_number', 'athlete_name', 'category', 'status', 'gender'],
        properties: {
          bib_number: { type: 'string', minLength: 1, maxLength: 32, example: '1001' },
          athlete_name: { type: 'string', minLength: 1, maxLength: 200, example: 'Ana Silva' },
          category: { type: 'string', minLength: 1, maxLength: 80, example: 'Adulto 25-34' },
          status: { type: 'string', minLength: 1, maxLength: 40, example: 'Concluído' },
          gender: { type: 'string', minLength: 1, maxLength: 20, example: 'Feminino' },
          rank_general: { type: 'integer', minimum: 1, nullable: true, example: 1 },
          rank_category: { type: 'integer', minimum: 1, nullable: true, example: 1 },
          time_gross: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{2,}:\\d{2}:\\d{2}\\.\\d{3}$',
            example: '00:32:14.250',
          },
          time_net: {
            type: 'string',
            nullable: true,
            pattern: '^\\d{2,}:\\d{2}:\\d{2}\\.\\d{3}$',
            example: '00:32:10.800',
          },
          team_name: { type: 'string', maxLength: 200, nullable: true, example: 'Equipe Horizonte' },
          pace: { type: 'string', maxLength: 20, nullable: true, example: '3:44 min/km' },
        },
      },
      Event: {
        type: 'object',
        required: ['title', 'slug', 'total_results', 'imported_at'],
        properties: {
          title: { type: 'string', example: eventExample.title },
          slug: { type: 'string', example: eventExample.slug },
          total_results: { type: 'integer', minimum: 0, example: 1 },
          imported_at: { type: 'string', format: 'date-time', example: eventExample.imported_at },
        },
      },
      EventSummary: {
        type: 'object',
        required: ['title', 'slug'],
        properties: {
          title: { type: 'string', example: eventExample.title },
          slug: { type: 'string', example: eventExample.slug },
        },
      },
      Result: {
        type: 'object',
        required: [
          'id', 'bib_number', 'athlete_name', 'category', 'status', 'gender',
          'rank_general', 'rank_category', 'time_gross', 'time_net', 'team_name', 'pace',
        ],
        properties: {
          id: { type: 'string', format: 'uuid', example: exampleResult.id },
          bib_number: { type: 'string', example: exampleResult.bib_number },
          athlete_name: { type: 'string', example: exampleResult.athlete_name },
          category: { type: 'string', example: exampleResult.category },
          status: { type: 'string', example: exampleResult.status },
          gender: { type: 'string', example: exampleResult.gender },
          rank_general: { type: 'integer', nullable: true, example: exampleResult.rank_general },
          rank_category: { type: 'integer', nullable: true, example: exampleResult.rank_category },
          time_gross: { type: 'string', nullable: true, example: exampleResult.time_gross },
          time_net: { type: 'string', nullable: true, example: exampleResult.time_net },
          team_name: { type: 'string', nullable: true, example: exampleResult.team_name },
          pace: { type: 'string', maxLength: 20, nullable: true, example: exampleResult.pace },
        },
      },
      ImportResultsResponse: {
        type: 'object',
        required: ['event', 'imported_count'],
        properties: {
          event: { $ref: '#/components/schemas/Event' },
          imported_count: { type: 'integer', minimum: 0, example: 1 },
          accepted: { type: 'boolean', example: true },
          changed: { type: 'boolean', example: true },
          version: { type: 'string', nullable: true, example: 'sha256' },
        },
      },
      IngestionAcceptedResponse: {
        type: 'object',
        required: ['accepted', 'changed', 'event_slug', 'request_id', 'queue_position'],
        properties: {
          accepted: { type: 'boolean', example: true },
          changed: { type: 'boolean', nullable: true, example: null },
          event_slug: { type: 'string', example: exampleImport.event_slug },
          request_id: { type: 'string', format: 'uuid' },
          queue_position: { type: 'integer', minimum: 1, example: 1 },
        },
      },
      ResultsListResponse: {
        type: 'object',
        required: ['event', 'pagination', 'results'],
        properties: {
          event: {
            type: 'object',
            allOf: [{ $ref: '#/components/schemas/Event' }],
            nullable: true,
          },
          pagination: {
            type: 'object',
            required: ['page', 'limit', 'total'],
            properties: {
              page: { type: 'integer', minimum: 1, example: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, example: 50 },
              total: { type: 'integer', minimum: 0, example: 1 },
            },
          },
          results: { type: 'array', items: { $ref: '#/components/schemas/Result' } },
        },
      },
      SingleResultResponse: {
        type: 'object',
        required: ['event', 'result'],
        properties: {
          event: { $ref: '#/components/schemas/EventSummary' },
          result: { $ref: '#/components/schemas/Result' },
        },
      },
      ResetResultsResponse: {
        type: 'object',
        required: ['deleted_results', 'deleted_events'],
        properties: {
          deleted_results: { type: 'integer', minimum: 0, example: 3 },
          deleted_events: { type: 'integer', minimum: 0, example: 1 },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', example: 'Resultado não encontrado' } },
      },
      ValidationError: {
        type: 'object',
        required: ['error', 'details'],
        properties: {
          error: { type: 'string', example: validationErrorExample.error },
          details: {
            type: 'array',
            items: {
              type: 'object',
              required: ['code', 'path', 'message'],
              properties: {
                code: { type: 'string', example: 'custom' },
                path: {
                  type: 'array',
                  items: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
                  example: ['total_results'],
                },
                message: { type: 'string', example: validationErrorExample.details[0].message },
              },
            },
          },
        },
      },
    },
  },
};
