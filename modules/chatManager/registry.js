// ============================================================================
// FILE: modules/chatManager/registry.js
// PURPOSE: Listener registry + cleanup helpers for chat feeds
// ============================================================================

const listenerRegistry = {
  control: [],
  player: [],
  others: new Map(),
};

export function clearRegistry(key) {
  if (Array.isArray(listenerRegistry[key])) {
    if (!listenerRegistry[key].length) return;
    console.info(`🧹 [chatManager] detaching ${listenerRegistry[key].length} listener(s) for ${key}`);
    listenerRegistry[key].forEach(unsub => {
      try { unsub?.(); } catch {}
    });
    listenerRegistry[key] = [];
  } else if (listenerRegistry.others instanceof Map && listenerRegistry.others.has(key)) {
    const arr = listenerRegistry.others.get(key) || [];
    if (!arr.length) return;
    console.info(`🧹 [chatManager] detaching ${arr.length} listener(s) for group ${key}`);
    arr.forEach(unsub => {
      try { unsub?.(); } catch {}
    });
    listenerRegistry.others.delete(key);
  }
}

export function registerListener(key, unsub) {
  if (!unsub) return;
  if (Array.isArray(listenerRegistry[key])) {
    listenerRegistry[key].push(unsub);
  } else {
    if (!listenerRegistry.others.has(key)) listenerRegistry.others.set(key, []);
    listenerRegistry.others.get(key).push(unsub);
  }
}
