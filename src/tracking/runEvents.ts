type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Мікро-емітер замість зайвої залежності. Бекграунд-таск і UI живуть в одному
 * JS-контексті, поки апка не вбита; якщо вбита — слухачів просто немає,
 * а стан однаково лежить у SQLite.
 */
export function subscribeRunUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitRunUpdated(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (e) {
      if (__DEV__) console.error('[runEvents] listener:', e);
    }
  }
}
