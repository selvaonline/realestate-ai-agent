import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

export type AgentEvent =
  | { kind: 'run_started'|'run_finished'|'status'|'wait'|'nav'|'action'|'shot'|'extracted'|'fallback'|'heartbeat'|'thinking'|'source_found'|'answer_chunk'|'answer_complete'|'deal_found'|'property_progress'|'browser_preview';
      runId: string; t: number; [k: string]: any };

@Injectable({ providedIn: 'root' })
export class AgentService {
  // Point directly at your orchestrator (Node) that serves /run, /events/:runId, /result/:runId
  // Allow overriding via localStorage('apiUrl') for cross-machine/dev setups
  private base = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');

  async startRun(query: string): Promise<string> {
    const r = await fetch(`${this.base}/run`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (!r.ok) {
      const text = await r.text();
      console.error('[agent.service] /run failed:', r.status, text);
      throw new Error(`Failed to start run: ${r.status} ${text}`);
    }
    
    const text = await r.text();
    if (!text || text.trim() === '') {
      console.error('[agent.service] /run returned empty response');
      throw new Error('Empty response from server');
    }
    
    let j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      console.error('[agent.service] Failed to parse JSON:', text);
      throw new Error('Invalid JSON response from server');
    }
    
    if (!j.runId) throw new Error('no runId in response');
    return j.runId;
  }

  openEvents(runId: string, onEvent: (ev: AgentEvent) => void) {
    const es = new EventSource(`${this.base}/events/${runId}`);
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch {} };
    return () => es.close();
  }

  async getResult(runId: string) {
    const r = await fetch(`${this.base}/result/${runId}`);
    if (!r.ok) {
      const text = await r.text();
      console.error('[agent.service] /result failed:', r.status, text);
      throw new Error('result not ready');
    }
    
    const text = await r.text();
    if (!text || text.trim() === '') {
      console.error('[agent.service] /result returned empty response');
      throw new Error('Empty result from server');
    }
    
    try {
      return JSON.parse(text) as { plan:string; deals:any[] };
    } catch (e) {
      console.error('[agent.service] Failed to parse result JSON:', text);
      throw new Error('Invalid JSON in result');
    }
  }
}
