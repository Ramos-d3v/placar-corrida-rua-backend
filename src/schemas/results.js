import { z } from 'zod';

const raceTimeSchema = z
  .string()
  .regex(/^\d{2,}:\d{2}:\d{2}\.\d{3}$/, 'Use o formato HH:MM:SS.mmm')
  .nullable()
  .optional();

const resultSchema = z.object({
  bib_number: z.string().trim().min(1).max(32),
  athlete_name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(40),
  gender: z.string().trim().min(1).max(20),
  rank_general: z.number().int().positive().nullable().optional(),
  rank_category: z.number().int().positive().nullable().optional(),
  time_gross: raceTimeSchema,
  time_net: raceTimeSchema,
  team_name: z.string().trim().max(200).nullable().optional(),
});

export const importResultsSchema = z
  .object({
    event_title: z.string().trim().min(1).max(200),
    event_slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens'),
    total_results: z.number().int().nonnegative(),
    results: z.array(resultSchema).max(50000),
  })
  .superRefine((payload, context) => {
    if (payload.results.length !== payload.total_results) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['total_results'],
        message: 'total_results deve corresponder à quantidade de itens em results',
      });
    }

    const bibNumbers = new Set();
    payload.results.forEach((result, index) => {
      if (bibNumbers.has(result.bib_number)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['results', index, 'bib_number'],
          message: 'Número de peito duplicado no lote',
        });
      }
      bibNumbers.add(result.bib_number);
    });
  });

export const resultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  gender: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export function toPublicResult(result) {
  return {
    id: result.id,
    bib_number: result.bibNumber,
    athlete_name: result.athleteName,
    category: result.category,
    status: result.status,
    gender: result.gender,
    rank_general: result.rankGeneral,
    rank_category: result.rankCategory,
    time_gross: result.timeGross,
    time_net: result.timeNet,
    team_name: result.teamName,
  };
}