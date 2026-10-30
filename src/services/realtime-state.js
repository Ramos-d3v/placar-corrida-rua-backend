import { createHash } from 'node:crypto';

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((sorted, key) => {
      sorted[key] = sortValue(value[key]);
      return sorted;
    }, {});
  }

  return value;
}

export function hashPayload(payload) {
  const canonicalPayload = JSON.stringify(sortValue(payload));
  return createHash('sha256').update(canonicalPayload).digest('hex');
}

export class RealtimeStateStore {
  #states = new Map();

  get(eventSlug) {
    return this.#states.get(eventSlug) ?? null;
  }

  set(eventSlug, payload) {
    const version = hashPayload(payload);
    const state = {
      event_slug: eventSlug,
      version,
      updated_at: new Date().toISOString(),
      payload,
    };

    this.#states.set(eventSlug, state);
    return state;
  }

  hasChanged(eventSlug, payload) {
    return this.get(eventSlug)?.version !== hashPayload(payload);
  }

  updateAthlete(eventSlug, bibNumber, athleteData) {
    const state = this.get(eventSlug);
    if (!state || !state.payload || !Array.isArray(state.payload.results)) return null;

    const idx = state.payload.results.findIndex((r) => r.bib_number === bibNumber);
    if (idx !== -1) {
      const current = state.payload.results[idx];
      state.payload.results[idx] = {
        ...current,
        ...athleteData,
      };
      return this.set(eventSlug, state.payload);
    }
    return null;
  }

  delete(eventSlug) {
    return this.#states.delete(eventSlug);
  }

  clear() {
    this.#states.clear();
  }
}

export const realtimeState = new RealtimeStateStore();
