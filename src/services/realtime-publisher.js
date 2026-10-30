import { EventEmitter } from 'node:events';

export class RealtimePublisher extends EventEmitter {
  publishUpdate(state) {
    this.emit('updated', state);
  }

  publishReset() {
    this.emit('reset');
  }
}

export const realtimePublisher = new RealtimePublisher();
