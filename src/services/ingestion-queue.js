import { EventEmitter } from 'node:events';
import { env } from '../config/env.js';
import { ingestResults } from './ingestion.js';

export class IngestionQueueFullError extends Error {
  constructor() {
    super('Fila de ingestão sem capacidade');
    this.name = 'IngestionQueueFullError';
  }
}

export class IngestionQueue extends EventEmitter {
  #items = [];
  #processing = false;
  #stopping = false;
  #idleResolvers = [];

  constructor(processor, maxSize) {
    super();
    this.processor = processor;
    this.maxSize = maxSize;
  }

  enqueue(payload) {
    const activeJobs = this.#processing ? 1 : 0;
    if (this.#stopping || this.#items.length + activeJobs >= this.maxSize) {
      throw new IngestionQueueFullError();
    }

    this.#items.push(payload);
    const position = this.#items.length;
    void this.#drain();
    return { position };
  }

  async #drain() {
    if (this.#processing) return;
    this.#processing = true;

    while (this.#items.length > 0) {
      const payload = this.#items.shift();
      try {
        await this.processor(payload);
        this.emit('processed', payload);
      } catch (error) {
        this.emit('failed', error, payload);
        console.error('Ingestion job failed', error);
      }
    }

    this.#processing = false;
    this.#resolveIdle();
  }

  #resolveIdle() {
    const resolvers = this.#idleResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  }

  async stop() {
    this.#stopping = true;
    if (!this.#processing && this.#items.length === 0) return;
    await new Promise((resolve) => this.#idleResolvers.push(resolve));
  }
}

export const ingestionQueue = new IngestionQueue(ingestResults, env.ingestionQueueMaxSize);
