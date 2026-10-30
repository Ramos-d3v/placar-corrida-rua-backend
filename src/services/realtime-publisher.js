import { EventEmitter } from 'node:events';

export class RealtimePublisher extends EventEmitter {
  publishUpdate(state) {
    this.emit('updated', state);
  }

  publishAthleteUpdate(update) {
    this.emit('athlete.updated', update);
  }

  publishReset() {
    this.emit('reset');
  }
}

export const realtimePublisher = new RealtimePublisher();
