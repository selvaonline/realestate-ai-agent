// src/lib/event-bus.ts
type Subscriber = (ev: any) => void;
const channels = new Map<string, Set<Subscriber>>();

export function sub(runId: string, fn: Subscriber) {
  if (!channels.has(runId)) channels.set(runId, new Set());
  channels.get(runId)!.add(fn);
  return () => channels.get(runId)!.delete(fn);
}
export function pub(runId: string, ev: any) {
  channels.get(runId)?.forEach(fn => fn(ev));
}
