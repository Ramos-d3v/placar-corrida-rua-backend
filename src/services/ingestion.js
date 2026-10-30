import { importResultsSchema } from '../schemas/results.js';
import { resetResults, upsertEventResults } from './results.js';
import { realtimePublisher } from './realtime-publisher.js';
import { realtimeState } from './realtime-state.js';

export async function ingestResults(input) {
  const payload = importResultsSchema.parse(input);
  const eventSlug = payload.event_slug;

  if (!realtimeState.hasChanged(eventSlug, payload)) {
    return {
      accepted: true,
      changed: false,
      event_slug: eventSlug,
    };
  }

  const imported = await upsertEventResults(payload);
  const state = realtimeState.set(eventSlug, payload);
  const update = {
    ...state,
    event: imported.event,
    imported_count: payload.results.length,
  };

  realtimePublisher.publishUpdate(update);

  return {
    accepted: true,
    changed: true,
    ...imported,
    imported_count: payload.results.length,
    version: state.version,
  };
}

export async function resetIngestedResults() {
  const result = await resetResults();
  realtimeState.clear();
  realtimePublisher.publishReset();
  return result;
}
