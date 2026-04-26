/** Tiny typed event bus for decoupling UI from game logic. */
type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private listeners: Partial<{ [K in keyof Events]: Handler<Events[K]>[] }> = {};

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    (this.listeners[event] ??= []).push(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: Handler<Events[K]>) {
    const arr = this.listeners[event];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const arr = this.listeners[event];
    if (!arr) return;
    for (const fn of arr) fn(payload);
  }
}
