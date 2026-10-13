import { prisma } from '../db/prisma.js';
import { toPublicResult } from '../schemas/results.js';

function toDatabaseResult(result, eventId) {
  return {
    eventId,
    bibNumber: result.bib_number,
    athleteName: result.athlete_name,
    category: result.category,
    status: result.status,
    gender: result.gender,
    rankGeneral: result.rank_general ?? null,
    rankCategory: result.rank_category ?? null,
    timeGross: result.time_gross ?? null,
    timeNet: result.time_net ?? null,
    teamName: result.team_name ?? null,
  };
}

export async function replaceEventResults(payload) {
  const importedAt = new Date();

  return prisma.$transaction(async (transaction) => {
    await transaction.result.deleteMany();
    await transaction.event.deleteMany();

    const event = await transaction.event.create({
      data: {
        title: payload.event_title,
        slug: payload.event_slug,
        totalResults: payload.total_results,
        importedAt,
      },
    });

    if (payload.results.length > 0) {
      await transaction.result.createMany({
        data: payload.results.map((result) => toDatabaseResult(result, event.id)),
      });
    }

    return {
      event: {
        title: event.title,
        slug: event.slug,
        total_results: payload.total_results,
        imported_at: importedAt.toISOString(),
      },
    };
  });
}

export async function resetResults() {
  return prisma.$transaction(async (transaction) => {
    const deletedResults = await transaction.result.deleteMany();
    const deletedEvents = await transaction.event.deleteMany();

    return {
      deleted_results: deletedResults.count,
      deleted_events: deletedEvents.count,
    };
  });
}

function buildWhere(eventId, filters) {
  const where = { eventId };

  if (filters.gender) where.gender = filters.gender;
  if (filters.category) where.category = filters.category;
  if (filters.search) {
    where.OR = [
      { athleteName: { contains: filters.search, mode: 'insensitive' } },
      { bibNumber: { contains: filters.search } },
    ];
  }

  return where;
}

async function getLatestEvent() {
  return prisma.event.findFirst({ orderBy: { importedAt: 'desc' } });
}

export async function listResults(filters) {
  const event = await getLatestEvent();
  if (!event) return { event: null, pagination: { page: filters.page, limit: filters.limit, total: 0 }, results: [] };

  const where = buildWhere(event.id, filters);
  const [total, results] = await prisma.$transaction([
    prisma.result.count({ where }),
    prisma.result.findMany({
      where,
      orderBy: [{ rankGeneral: { sort: 'asc', nulls: 'last' } }, { bibNumber: 'asc' }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
  ]);

  return {
    event: { title: event.title, slug: event.slug, total_results: event.totalResults, imported_at: event.importedAt.toISOString() },
    pagination: { page: filters.page, limit: filters.limit, total },
    results: results.map(toPublicResult),
  };
}

export async function getResultByBibNumber(bibNumber) {
  const event = await getLatestEvent();
  if (!event) return null;

  const result = await prisma.result.findUnique({
    where: { eventId_bibNumber: { eventId: event.id, bibNumber } },
  });

  return result ? { event: { title: event.title, slug: event.slug }, result: toPublicResult(result) } : null;
}