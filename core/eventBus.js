// Tiny pub/sub with namespaced events
const listeners = new Map(); // eventName -> Set<fn>

export function on(eventName, fn) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(fn);
  return () => off(eventName, fn);
}

export function off(eventName, fn) {
  const set = listeners.get(eventName);
  if (set) set.delete(fn);
}

export function emit(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch (e) {
      console.error('[eventBus]', eventName, e);
    }
  }
}

// Alias helpers for ergonomic imports
export const subscribe = on;
export const unsubscribe = off;

export function publish(eventName, payload) {
  emit(eventName, payload);
}

// Convenience helper for notifications
export function notify({ kind = 'info', text = '', timeout = 3000 } = {}) {
  emit('ui:notify', { kind, text, timeout });
}
