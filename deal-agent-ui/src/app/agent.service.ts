import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

export type AgentEvent =
  | { kind: 'run_started'|'run_finished'|'status'|'wait'|'nav'|'action'|'shot'|'extracted'|'fallback'|'heartbeat'|'thinking'|'source_found'|'answer_chunk'|'answer_complete';
      runId: string; t: number; [k: string]: any };

@Injectable({ providedIn: 'root' })
export class AgentService {
  // Point directly at your orchestrator (Node) that serves /run, /events/:runId, /result/:runId
  private base = environment.apiUrl;

  async startRun(query: string): Promise<string> {
    const r = await fetch(`${this.base}/run`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ query })
    });
    const j = await r.json();
    if (!j.runId) throw new Error('no runId');
    return j.runId;
  }

  openEvents(runId: string, onEvent: (ev: AgentEvent) => void) {
    const es = new EventSource(`${this.base}/events/${runId}`);
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch {} };
    return () => es.close();
  }

  async getResult(runId: string) {
    const r = await fetch(`${this.base}/result/${runId}`);
    if (!r.ok) throw new Error('result not ready');
    return r.json() as Promise<{ plan:string; deals:any[] }>;
  }
}
