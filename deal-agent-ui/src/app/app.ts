import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentService, AgentEvent } from './agent.service';

type Card = {
  kind: 'status'|'wait'|'nav'|'action'|'fallback'|'shot'|'extracted'|'started'|'finished';
  label?: string;
  note?: string;
  url?: string;
  b64?: string;
  summary?: any;
  t: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="shell">
    <div class="header">RealEstate Deal Agent</div>

    <div class="ask">
      <input #qinput [value]="q()" (input)="q.set(qinput.value)"
             placeholder="Ask e.g. Find multifamily deals in Dallas cap > 6%" />
      <button (click)="run()" [disabled]="busy()">{{ busy() ? 'Running...' : 'Search' }}</button>
    </div>

    <div class="timeline" *ngIf="cards().length">
      <div class="card" *ngFor="let c of cards()">
        <ng-container [ngSwitch]="c.kind">

          <div *ngSwitchCase="'started'" class="status">
            <span class="chip">Setting up my desktop</span>
          </div>

          <div *ngSwitchCase="'status'" class="status">
            <span class="chip">{{c.label}}</span>
            <div class="note" *ngIf="c.note">{{c.note}}</div>
          </div>

          <div *ngSwitchCase="'wait'" class="status">
            <span class="chip hollow">Waiting</span> {{c.label}} <span class="dots"></span>
          </div>

          <div *ngSwitchCase="'nav'" class="status">
            <span class="chip blue">Navigating</span>
            <a *ngIf="c.url" [href]="c.url" target="_blank">{{c.label || c.url}}</a>
          </div>

          <div *ngSwitchCase="'action'" class="status">
            <span class="chip yellow">Action</span> {{c.label}}
          </div>

          <div *ngSwitchCase="'fallback'" class="status">
            <span class="chip orange">Fallback</span> {{c.label}}
          </div>

          <div *ngSwitchCase="'shot'" class="shot">
            <div class="frame"><img [src]="'data:image/png;base64,'+c.b64" alt="screenshot" /></div>
            <div class="caption">{{c.label}}</div>
          </div>

          <div *ngSwitchCase="'extracted'" class="extracted">
            <div class="chip green">Extracted</div>
            <pre>{{ c.summary | json }}</pre>
          </div>

          <div *ngSwitchCase="'finished'" class="status">
            <span class="chip green">Done</span>
          </div>

        </ng-container>
      </div>
    </div>

    <div class="deals" *ngIf="deals().length">
      <h3>Deals</h3>
      <div class="grid">
        <div class="deal" *ngFor="let d of deals()">
          <h4>{{ d.title || 'Listing' }}</h4>
          <a [href]="d.url" target="_blank">{{ d.source }}</a>
          <p class="addr">{{ d.address }}</p>
          <div class="kv">
            <div><strong>Asking:</strong> {{ d.askingPrice | currency:'USD' }}</div>
            <div><strong>NOI:</strong> {{ d.noi | currency:'USD' }}</div>
            <div><strong>Cap:</strong> {{ (d.capRate || d.underwrite?.capRate) | percent:'1.2-2' }}</div>
            <div><strong>DSCR:</strong> {{ d.underwrite?.dscr | number:'1.2-2' }}</div>
          </div>
          <img *ngIf="d.screenshotBase64" [src]="'data:image/png;base64,'+d.screenshotBase64" />
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    :host { color:#e9eef5; background:#0b0f14; min-height:100vh; display:block; }
    .shell { max-width: 920px; margin: 0 auto; padding: 20px; }
    .header { font-weight:700; font-size:20px; color:#c9d7ff; margin-bottom: 12px; }
    .ask { display:flex; gap:8px; margin-bottom:16px; }
    input { flex:1; background:#0f131a; border:1px solid #1d2735; color:#e9eef5; padding:10px 12px; border-radius:8px; }
    button { background:#2f5cff; border:none; color:#fff; padding:10px 16px; border-radius:8px; cursor:pointer; }
    button[disabled]{ opacity:.6; cursor:not-allowed; }
    .timeline { display:flex; flex-direction:column; gap:12px; margin-top:8px; }
    .card { background:#0f131a; border:1px solid #1d2735; border-radius:12px; padding:12px; }
    .status { display:flex; align-items:center; gap:8px; }
    .chip { background:#1d2735; color:#c9d7ff; padding:4px 8px; border-radius:999px; font-size:12px; }
    .chip.hollow { background:transparent; border:1px solid #334154; }
    .chip.blue { background:#0e3e9b; }
    .chip.yellow { background:#8b6b0e; }
    .chip.orange { background:#8b3d0e; }
    .chip.green { background:#0e6b36; }
    .note { color:#9fb0c0; font-size:12px; }
    .dots::after { content:'...'; animation: blink 1.2s infinite; }
    @keyframes blink { 50% { opacity:0.3 } }
    .frame { background:#0b0f14; border:1px solid #1d2735; border-radius:8px; overflow:hidden; }
    .frame img { width:100%; display:block; }
    .caption { font-size:12px; color:#9fb0c0; margin-top:6px; }
    .deals { margin-top: 18px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
    .deal { background:#0f131a; border:1px solid #1d2735; border-radius:12px; padding:12px; }
    .kv { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin:8px 0; }
    .addr { color:#99a9bd; font-size:13px; }
    img { border-radius:8px; margin-top:8px; }
  `]
})
export class App {
  q = signal('Find multifamily deals in Dallas cap > 6%');
  busy = signal(false);
  cards = signal<Card[]>([]);
  deals = signal<any[]>([]);

  constructor(private svc: AgentService) {}

  async run() {
    this.cards.set([]);
    this.deals.set([]);
    this.busy.set(true);
    try {
      const runId = await this.svc.startRun(this.q());
      this.cards.update(c => [...c, { kind:'started', label:'Setting up my desktop', t:Date.now() }]);
      const stop = this.svc.openEvents(runId, (ev: AgentEvent) => this.onEvent(ev));
      const poll = setInterval(async () => {
        const finished = this.cards().some(x => x.kind === 'finished');
        if (finished) {
          clearInterval(poll);
          stop();
          try {
            const result = await this.svc.getResult(runId);
            this.deals.set(result.deals || []);
          } catch { /* ignore */ }
          this.busy.set(false);
        }
      }, 400);
    } catch (e) {
      this.busy.set(false);
      alert('Run failed');
    }
  }

  onEvent(ev: AgentEvent) {
    const push = (c: Card) => this.cards.update(arr => [...arr, c]);
    switch (ev.kind) {
      case 'status':   push({ kind:'status', label: ev['label'], note: ev['note'], t:ev.t }); break;
      case 'wait':     push({ kind:'wait', label: ev['label'], t:ev.t }); break;
      case 'nav':      push({ kind:'nav', label: (ev['label'] || ev['url']), url: ev['url'], t:ev.t }); break;
      case 'action':   push({ kind:'action', label: ev['label'], t:ev.t }); break;
      case 'fallback': push({ kind:'fallback', label: ev['label'], t:ev.t }); break;
      case 'shot':     push({ kind:'shot', label: ev['label'], b64: ev['b64'], t:ev.t }); break;
      case 'extracted':push({ kind:'extracted', summary: ev['summary'], t:ev.t }); break;
      case 'run_started':  push({ kind:'started', label:'Setting up my desktop', t:ev.t }); break;
      case 'run_finished': push({ kind:'finished', label:'Done', t:ev.t }); break;
    }
  }
}
