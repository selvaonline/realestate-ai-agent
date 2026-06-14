import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface NsNode { id: string; type: 'front_man' | 'specialist' | 'tool'; parent?: string }
export interface NsNetwork { nodes: NsNode[]; edges: { from: string; to: string }[] }

interface LayoutNode extends NsNode { x: number; y: number; w: number; h: number; label: string }
interface LayoutEdge { from: string; to: string; d: string }

/**
 * Live multi-agent network graph: supervisor on top, specialists in the
 * middle, tools below. Nodes light up and edges animate as ns_hop /
 * tool_executing events arrive. Works for any orchestrator (LangGraph.js,
 * LangGraph) that emits the shared event vocabulary.
 */
@Component({
  selector: 'app-agent-network',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="ns-panel" *ngIf="network">
    <div class="ns-header">
      <span class="ns-title">
        <span class="ns-pulse" [class.live]="running"></span>
        Multi-Agent Orchestration
      </span>
      <span class="ns-badge" [class.badge-lg]="orchestrator === 'LangGraph.js'">{{ orchestrator }}</span>
      <span class="ns-sub">{{ specialists.length }} specialists · {{ toolCount }} tools</span>
      <span class="ns-stats">
        <span class="stat" *ngIf="hops"><b>{{ hops }}</b> hops</span>
        <span class="stat" *ngIf="elapsed"><b>{{ elapsed }}</b>s</span>
        <span class="stat" *ngIf="running" class="stat-live">● live</span>
        <button class="ns-replay" *ngIf="canReplay && !running" (click)="replay.emit()"
                title="Re-animate this orchestration">↻ Replay</button>
      </span>
    </div>
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="nsActiveGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fbbf24"/>
        </linearGradient>
        <linearGradient id="nsFrontGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#27407a"/><stop offset="100%" stop-color="#16254a"/>
        </linearGradient>
      </defs>
      <path *ngFor="let e of layoutEdges" [attr.d]="e.d"
            class="ns-edge"
            [class.edge-active]="isEdgeActive(e.from, e.to)"
            [class.edge-visited]="isEdgeVisited(e.from, e.to)"/>
      <g *ngFor="let n of layoutNodes"
         [attr.class]="'ns-node n-' + n.type + (isActive(n.id) ? ' n-active' : isVisited(n.id) ? ' n-visited' : '')">
        <rect [attr.x]="n.x - n.w/2" [attr.y]="n.y - n.h/2" [attr.width]="n.w" [attr.height]="n.h"
              [attr.rx]="n.type === 'tool' ? n.h/2 : 8"/>
        <text [attr.x]="n.x" [attr.y]="n.y + 3.5" text-anchor="middle">{{ n.label }}</text>
        <g *ngIf="calls(n.id)">
          <circle [attr.cx]="n.x + n.w/2 - 2" [attr.cy]="n.y - n.h/2 + 2" r="8" class="ns-count-bg"/>
          <text [attr.x]="n.x + n.w/2 - 2" [attr.y]="n.y - n.h/2 + 5.2" text-anchor="middle" class="ns-count">{{ calls(n.id) }}</text>
        </g>
      </g>
    </svg>
    <div class="ns-legend">
      <span><i class="lg lg-front"></i> supervisor</span>
      <span><i class="lg lg-spec"></i> specialist agent</span>
      <span><i class="lg lg-tool"></i> tool (zero-token API call)</span>
      <span><i class="lg lg-act"></i> active</span>
      <span><i class="lg lg-done"></i> visited</span>
    </div>
  </div>
  `,
  styles: [`
    .ns-panel {
      background:
        radial-gradient(circle at 1px 1px, rgba(148,163,184,.10) 1px, transparent 0) 0 0/22px 22px,
        radial-gradient(1200px 380px at 50% -40px, #16254a 0%, #0b1220 58%);
      border:1px solid transparent; border-radius:16px; padding:16px 20px 12px; margin:14px 0;
      box-shadow: 0 0 0 1px #1e293b, 0 0 24px rgba(59,130,246,.12), 0 14px 40px rgba(2,6,17,.5);
      position:relative; overflow:hidden;
    }
    .ns-panel::before {
      content:''; position:absolute; inset:0 0 auto 0; height:2px;
      background:linear-gradient(90deg, transparent, #3b82f6 30%, #8b5cf6 50%, #f59e0b 70%, transparent);
      opacity:.8;
    }
    .ns-header { display:flex; align-items:center; gap:12px; margin-bottom:6px; flex-wrap:wrap; }
    .ns-title { color:#e2e8f0; font-weight:700; font-size:14px; display:inline-flex; align-items:center; gap:8px; letter-spacing:.2px; }
    .ns-badge { font-size:11px; font-weight:700; padding:2px 9px; border-radius:999px;
                background:rgba(245,158,11,.14); color:#fbbf24; border:1px solid rgba(245,158,11,.4); }
    .ns-badge.badge-lg { background:rgba(45,212,191,.12); color:#5eead4; border-color:rgba(45,212,191,.4); }
    .ns-sub { color:#64748b; font-size:12px; }
    .ns-stats { margin-left:auto; display:inline-flex; gap:14px; color:#94a3b8; font-size:12px; }
    .ns-stats b { color:#e2e8f0; }
    .stat-live { color:#22c55e; animation: nsblink 1.1s ease-in-out infinite; }
    .ns-replay { font-size:11.5px; font-weight:700; color:#93c5fd; background:rgba(59,130,246,.12);
                 border:1px solid rgba(59,130,246,.45); border-radius:999px; padding:3px 12px; cursor:pointer;
                 transition:all .15s; }
    .ns-replay:hover { background:rgba(59,130,246,.25); box-shadow:0 0 10px rgba(59,130,246,.4); }
    .ns-pulse { width:8px; height:8px; border-radius:50%; background:#334155; display:inline-block; }
    .ns-pulse.live { background:#22c55e; box-shadow:0 0 8px #22c55e; animation: nsblink 1.1s ease-in-out infinite; }
    @keyframes nsblink { 50% { opacity:.3 } }
    svg { width:100%; height:auto; display:block; }

    .ns-edge { stroke:#22304a; stroke-width:1.3; fill:none; transition: stroke .25s; }
    .ns-edge.edge-visited { stroke:#2a5a40; }
    .ns-edge.edge-active { stroke:url(#nsActiveGrad); stroke-width:2.4; stroke-dasharray:7 5;
                           animation: nsflow .6s linear infinite; filter:drop-shadow(0 0 3px rgba(245,158,11,.5)); }
    @keyframes nsflow { to { stroke-dashoffset:-12; } }

    .ns-node rect { fill:#141e30; stroke:#2c3e57; stroke-width:1.2; transition: all .25s;
                    filter:drop-shadow(0 2px 4px rgba(2,6,17,.6)); }
    .ns-node text { fill:#9fb0c7; font-size:10.5px; font-family:inherit; }
    .n-front_man rect { fill:url(#nsFrontGrad); stroke:#60a5fa; stroke-width:1.8;
                        filter:drop-shadow(0 0 10px rgba(59,130,246,.35)); }
    .n-front_man text { fill:#eff6ff; font-weight:700; font-size:11.5px; letter-spacing:.3px; }
    .n-specialist rect { fill:#172339; stroke:#33507e; }
    .n-specialist text { fill:#bcd0ea; font-weight:600; }
    .n-tool rect { fill:#101a29; stroke:#243246; }
    .n-tool text { fill:#7e93ad; font-size:8.6px; }

    .n-visited rect { stroke:#22c55e; }
    .n-visited text { fill:#86efac; }
    .n-active rect { stroke:#f59e0b; stroke-width:2.4;
                     filter:drop-shadow(0 0 8px rgba(245,158,11,.8));
                     animation: nsnode 1s ease-in-out infinite; }
    .n-active text { fill:#fde68a; font-weight:700; }
    @keyframes nsnode { 50% { filter:drop-shadow(0 0 3px rgba(245,158,11,.45)); } }

    .ns-count-bg { fill:#f59e0b; }
    .ns-count { fill:#0b1220; font-size:9px; font-weight:800; }

    .ns-legend { display:flex; gap:18px; margin-top:8px; color:#64748b; font-size:11px; flex-wrap:wrap; }
    .ns-legend i.lg { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:5px; vertical-align:-1px; border:1.4px solid; background:#141e30; }
    .lg-front { border-color:#3b82f6; } .lg-spec { border-color:#33507e; } .lg-tool { border-color:#243246; border-radius:6px; }
    .lg-act { border-color:#f59e0b; box-shadow:0 0 5px rgba(245,158,11,.7); } .lg-done { border-color:#22c55e; }
  `],
})
export class AgentNetworkPanelComponent implements OnDestroy {
  @Input() set network(v: NsNetwork | null) { this._network = v; if (v) this.layout(v); }
  get network(): NsNetwork | null { return this._network; }
  @Input() activeChain: string[] = [];
  @Input() visited: string[] = [];
  @Input() nodeCalls: Record<string, number> = {};
  @Input() orchestrator = 'Neuro SAN';
  @Input() hops = 0;
  @Input() canReplay = false;
  @Output() replay = new EventEmitter<void>();
  @Input() set running(v: boolean) {
    if (v && !this._running) { this._t0 = Date.now(); this.startTimer(); }
    if (!v) this.stopTimer();
    this._running = v;
  }
  get running() { return this._running; }

  private _network: NsNetwork | null = null;
  private _running = false;
  private _t0 = 0;
  private _timer: any = null;
  elapsed = 0;

  W = 1080;
  H = 330;
  layoutNodes: LayoutNode[] = [];
  layoutEdges: LayoutEdge[] = [];
  specialists: NsNode[] = [];
  toolCount = 0;

  isActive(id: string) { return this.activeChain.includes(id); }
  isVisited(id: string) { return !this.isActive(id) && this.visited.includes(id); }
  calls(id: string) { return this.nodeCalls[id] || 0; }
  isEdgeActive(from: string, to: string) {
    const i = this.activeChain.indexOf(from);
    return i >= 0 && this.activeChain[i + 1] === to;
  }
  isEdgeVisited(from: string, to: string) {
    return !this.isEdgeActive(from, to) && this.visited.includes(from) && this.visited.includes(to);
  }

  private startTimer() {
    this.stopTimer();
    this.elapsed = 0;
    this._timer = setInterval(() => { this.elapsed = Math.round((Date.now() - this._t0) / 1000); }, 1000);
  }
  private stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
  ngOnDestroy() { this.stopTimer(); }

  private label(id: string) {
    const s = id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return s.length > 24 ? s.slice(0, 23) + '…' : s;
  }

  private layout(net: NsNetwork) {
    const front = net.nodes.find(n => n.type === 'front_man');
    this.specialists = net.nodes.filter(n => n.type === 'specialist');
    const tools = net.nodes.filter(n => n.type === 'tool');
    this.toolCount = tools.length;

    const nodes: LayoutNode[] = [];
    const colW = this.W / Math.max(this.specialists.length, 1);

    if (front) nodes.push({ ...front, x: this.W / 2, y: 36, w: 158, h: 32, label: this.label(front.id) });

    this.specialists.forEach((s, i) => {
      const x = colW * i + colW / 2;
      nodes.push({ ...s, x, y: 118, w: Math.min(colW - 14, 148), h: 28, label: this.label(s.id) });
      tools.filter(t => t.parent === s.id).forEach((t, j) => {
        nodes.push({ ...t, x, y: 178 + j * 36, w: Math.min(colW - 18, 142), h: 22, label: this.label(t.id) });
      });
    });

    this.H = Math.max(...nodes.map(n => n.y + n.h / 2)) + 14;
    const pos = new Map(nodes.map(n => [n.id, n]));
    this.layoutEdges = net.edges
      .filter(e => pos.has(e.from) && pos.has(e.to))
      .map(e => {
        const a = pos.get(e.from)!, b = pos.get(e.to)!;
        const y1 = a.y + a.h / 2, y2 = b.y - b.h / 2;
        const my = (y1 + y2) / 2;
        return { from: e.from, to: e.to, d: `M ${a.x} ${y1} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${y2}` };
      });
    this.layoutNodes = nodes;
  }
}
