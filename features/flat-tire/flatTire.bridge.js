import { emit } from '/core/eventBus.js';

export function notifyFlatTireEvent(payload) {
  emit('flatTire:update', payload);
}
