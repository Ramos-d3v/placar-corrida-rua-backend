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

export async function upsertEventResults(payload) {
  const importedAt = new Date();

  return prisma.$transaction(async (transaction) => {
    const event = await transaction.event.upsert({
      where: { slug: payload.event_slug },
      update: {
        title: payload.event_title,
        importedAt,
      },
      create: {
        title: payload.event_title,
        slug: payload.event_slug,
        totalResults: payload.total_results,
        importedAt,
      },
    });

    if (payload.results.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < payload.results.length; i += chunkSize) {
        const chunk = payload.results.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map((result) =>
            transaction.result.upsert({
              where: {
                eventId_bibNumber: {
                  eventId: event.id,
                  bibNumber: result.bib_number,
                },
              },
              update: {
                athleteName: result.athlete_name,
                category: result.category,
                status: result.status,
                gender: result.gender,
                rankGeneral: result.rank_general ?? null,
                rankCategory: result.rank_category ?? null,
                timeGross: result.time_gross ?? null,
                timeNet: result.time_net ?? null,
                teamName: result.team_name ?? null,
              },
              create: toDatabaseResult(result, event.id),
            }),
          ),
        );
      }
    }

    const actualTotal = await transaction.result.count({
      where: { eventId: event.id },
    });

    const updatedEvent = await transaction.event.update({
      where: { id: event.id },
      data: { totalResults: actualTotal },
    });

    return {
      event: {
        title: updatedEvent.title,
        slug: updatedEvent.slug,
        total_results: updatedEvent.totalResults,
        imported_at: importedAt.toISOString(),
      },
    };
  });
}

export const replaceEventResults = upsertEventResults;

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
  const event = filters.event_slug
    ? await prisma.event.findUnique({ where: { slug: filters.event_slug } })
    : await getLatestEvent();
  if (!event) return { event: null, pagination: { page: filters.page, limit: filters.limit, total: 0 }, results: [] };

  const where = buildWhere(event.id, filters);
  const hasFilter = Boolean(filters.gender || filters.category || filters.search);
  const [total, results] = await prisma.$transaction([
    hasFilter
      ? prisma.result.count({ where })
      : Promise.resolve(event.totalResults),
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

export async function getResultByBibNumber(bibNumber, eventSlug = null) {
  const event = eventSlug
    ? await prisma.event.findUnique({ where: { slug: eventSlug } })
    : await getLatestEvent();
  if (!event) return null;

  const result = await prisma.result.findUnique({
    where: { eventId_bibNumber: { eventId: event.id, bibNumber } },
  });

  return result ? { event: { title: event.title, slug: event.slug }, result: toPublicResult(result) } : null;
}

export async function updateResultByBibNumber(bibNumber, data, eventSlug = null) {
  const event = eventSlug
    ? await prisma.event.findUnique({ where: { slug: eventSlug } })
    : await getLatestEvent();

  if (!event) return null;

  const existing = await prisma.result.findUnique({
    where: { eventId_bibNumber: { eventId: event.id, bibNumber } },
  });

  if (!existing) return null;

  const updateData = {};
  if (data.athlete_name !== undefined) updateData.athleteName = data.athlete_name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.rank_general !== undefined) updateData.rankGeneral = data.rank_general;
  if (data.rank_category !== undefined) updateData.rankCategory = data.rank_category;
  if (data.time_gross !== undefined) updateData.timeGross = data.time_gross;
  if (data.time_net !== undefined) updateData.timeNet = data.time_net;
  if (data.team_name !== undefined) updateData.teamName = data.team_name;

  const updated = await prisma.result.update({
    where: { id: existing.id },
    data: updateData,
  });

  return {
    event: { title: event.title, slug: event.slug },
    result: toPublicResult(updated),
  };
}