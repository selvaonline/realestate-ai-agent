import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

export type AgentEvent =
  | { kind: 'run_started'|'run_finished'|'status'|'wait'|'nav'|'action'|'shot'|'extracted'|'fallback'|'heartbeat'|'thinking'|'source_found'|'answer_chunk'|'answer_complete'|'deal_found'|'property_progress'|'browser_preview'|'agent_step'|'tool_executing'|'tool_complete'|'agent_done'|'mobility_result'|'ns_hop';
      runId: string; t: number; [k: string]: any };

@Injectable({ providedIn: 'root' })
export class AgentService {
  // Point directly at your orchestrator (Node) that serves /run, /events/:runId, /result/:runId
  // Allow overriding via localStorage('apiUrl') for cross-machine/dev setups
  private base = (localStorage.getItem('apiUrl') || environment.apiUrl).replace(/\/$/, '');

  async startRun(query: string, dataSources?: { enabledDomains: string[]; apiKeys: Record<string, string> }, orgSettings?: any): Promise<string> {
    const r = await fetch(`${this.base}/run`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ query, ...(dataSources ? { dataSources } : {}), ...(orgSettings ? { orgSettings } : {}) })
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

  /** Start a run through a multi-agent orchestrator: 'ns' (Neuro SAN) or 'lg' (LangGraph.js).
   * threadId (LangGraph only) keeps conversation memory across runs. */
  async startOrchestratedRun(orch: 'ns' | 'lg', query: string, threadId?: string): Promise<{ runId: string; threadId?: string }> {
    const r = await fetch(`${this.base}/api/${orch}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...(threadId ? { threadId } : {}) }),
    });
    if (!r.ok) {
      const text = await r.text();
      let msg = `Orchestrator run failed: ${r.status}`;
      try { msg = JSON.parse(text).error || msg; } catch {}
      throw new Error(msg);
    }
    const j = await r.json();
    if (!j.runId) throw new Error('no runId in response');
    return j;
  }

  /** Agent network topology (for the live graph panel). */
  async getOrchestratorNetwork(orch: 'ns' | 'lg'): Promise<{ nodes: any[]; edges: any[] }> {
    const r = await fetch(`${this.base}/api/${orch}/network`);
    if (!r.ok) throw new Error('orchestrator network unavailable');
    return r.json();
  }

  /** Full tool registry (descriptions, categories, parameter schemas). */
  async getToolRegistry(): Promise<Array<{ name: string; description: string; category: string; parameters: any; estimatedDurationMs?: number }>> {
    const r = await fetch(`${this.base}/api/tools/registry`);
    if (!r.ok) throw new Error('tool registry unavailable');
    return (await r.json()).tools;
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
