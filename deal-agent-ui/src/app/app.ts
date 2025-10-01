import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentService, AgentEvent } from './agent.service';

type Card = {
  kind: 'status'|'wait'|'nav'|'action'|'fallback'|'shot'|'extracted'|'started'|'finished'|'thinking'|'source'|'answer';
  label?: string;
  note?: string;
  url?: string;
  b64?: string;
  summary?: any;
  source?: { id: number; title: string; url: string; snippet: string };
  t: number;
};

type Source = { id: number; title: string; url: string; snippet: string };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="shell">
    <div class="header">RealEstate Deal Agent</div>

    <div class="ask">
      <input #qinput [value]="q()" (input)="q.set(qinput.value); stopTyping();"
             [placeholder]="typingPlaceholder()" 
             (focus)="stopTyping()" />
      <button (click)="run()" [disabled]="busy()">{{ busy() ? 'Running...' : 'Search' }}</button>
    </div>

    <!-- Perplexity-style Answer Section -->
    <div class="perplexity-section" *ngIf="answer() || sources().length">
      <!-- Thinking Steps -->
      <div class="thinking-steps" *ngIf="!answerComplete()">
        <div class="thinking-item" *ngFor="let c of cards()">
          <ng-container *ngIf="c.kind === 'thinking'">
            <div class="thinking-text">
              <span class="thinking-icon">🔍</span>
              {{ c.label }}
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Agent Navigation Steps (ChatGPT-style) -->
      <div class="agent-navigation" *ngIf="!answerComplete()">
        <div class="nav-item" *ngFor="let c of cards(); let i = index">
          <ng-container *ngIf="c.kind === 'nav' && c.url">
            <div class="nav-step">
              <span class="nav-icon">🌐</span>
              <div class="nav-content">
                <div class="nav-label">{{ c.label }}</div>
                <div class="nav-url">{{ c.url }}</div>
              </div>
              <span class="nav-spinner">⏳</span>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Streaming Answer with Citations -->
      <div class="answer-section" *ngIf="answer()">
        <div class="answer-text" [innerHTML]="answer()"></div>
        <div class="typing-indicator" *ngIf="!answerComplete()">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- Sources -->
      <div class="sources-section" *ngIf="sources().length && answerComplete()">
        <h3>Sources</h3>
        <div class="source-item" *ngFor="let src of sources()">
          <div class="source-num">[{{ src.id }}]</div>
          <div class="source-content">
            <a [href]="src.url" target="_blank" class="source-title">{{ src.title }}</a>
            <div class="source-snippet">{{ src.snippet }}</div>
          </div>
        </div>
      </div>

      <!-- Share Button -->
      <div class="share-section" *ngIf="answerComplete() && answer()">
        <button class="share-btn" (click)="shareResults()">
          <span class="share-icon">🔗</span> Share Results
        </button>
        <span class="share-status" *ngIf="shareStatus()">{{ shareStatus() }}</span>
      </div>
    </div>

    <!-- Legacy Timeline (expanded by default) -->
    <details class="timeline-details" *ngIf="cards().length" open>
      <summary>View detailed timeline</summary>
      <div class="timeline">
        <div class="card" *ngFor="let c of cards()">
          <ng-container [ngSwitch]="c.kind">

            <div *ngSwitchCase="'thinking'" class="status">
              <span class="chip purple">Thinking</span> {{c.label}}
            </div>

            <div *ngSwitchCase="'source'" class="source-card">
              <span class="chip blue">Source [{{c.source?.id}}]</span>
              <a [href]="c.source?.url" target="_blank">{{c.source?.title}}</a>
            </div>

            <div *ngSwitchCase="'answer'" class="answer-card">
              <div class="chip green">Answer</div>
              <div [innerHTML]="c.label"></div>
            </div>

            <div *ngSwitchCase="'started'" class="status">
              <span class="chip">Setting up my desktop</span>
            </div>

            <div *ngSwitchCase="'status'" class="status">
              <span class="chip">{{c.label}}</span>
              <div class="note" *ngIf="c.note">{{c.note}}</div>
            </div>

            <div *ngSwitchCase="'nav'" class="status">
              <span class="chip blue">Navigating</span>
              <a *ngIf="c.url" [href]="c.url" target="_blank">{{c.label || c.url}}</a>
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
    </details>

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
  `,
  styles: [`
    :host { color:#e9eef5; background:#0b0f14; min-height:100vh; display:block; }
    .shell { max-width: 920px; margin: 0 auto; padding: 20px; }
    .header { font-weight:700; font-size:20px; color:#c9d7ff; margin-bottom: 12px; }
    .ask { display:flex; gap:12px; margin:20px 0; }
    input { flex:1; padding:12px 16px; background:#0f131a; border:1px solid #1d2735; border-radius:8px; color:#e9eef5; font-size:15px; }
    input::placeholder { color: #9fb0c0; opacity: 1; }
    input:focus { outline:none; border-color:#2f5cff; }
    button { padding:12px 24px; background:#2f5cff; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:15px; }
    button:hover:not(:disabled) { background:#4169ff; }
    button:disabled { opacity:0.6; cursor:not-allowed; }

    /* Perplexity-style sections */
    .perplexity-section { margin-top: 24px; }
    
    .thinking-steps { margin-bottom: 16px; }
    .thinking-item { margin-bottom: 8px; }
    .thinking-text { 
      display: flex; 
      align-items: center; 
      gap: 8px; 
      color: #9fb0c0; 
      font-size: 14px;
      padding: 8px 0;
    }
    .thinking-icon { font-size: 16px; }

    /* Agent Navigation Steps (ChatGPT-style) */
    .agent-navigation { 
      margin: 16px 0; 
      background: #0a0d12; 
      border: 1px solid #1d2735; 
      border-radius: 8px; 
      padding: 16px;
    }
    .nav-item { margin-bottom: 12px; }
    .nav-item:last-child { margin-bottom: 0; }
    .nav-step { 
      display: flex; 
      align-items: flex-start; 
      gap: 12px; 
      padding: 12px;
      background: #0f131a;
      border-radius: 8px;
      border: 1px solid #252f3f;
    }
    .nav-icon { font-size: 18px; flex-shrink: 0; margin-top: 2px; }
    .nav-content { flex: 1; min-width: 0; }
    .nav-label { 
      color: #c9d7ff; 
      font-weight: 500; 
      font-size: 14px;
      margin-bottom: 4px;
    }
    .nav-url { 
      color: #5b7a9f; 
      font-size: 13px; 
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nav-preview {
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #252f3f;
      background: #000;
    }
    .nav-screenshot {
      width: 100%;
      height: auto;
      max-height: 300px;
      object-fit: cover;
      display: block;
    }
    .preview-label {
      padding: 8px 12px;
      background: #0a0d12;
      color: #7b8a9e;
      font-size: 12px;
      text-align: center;
      border-top: 1px solid #252f3f;
    }
    .nav-spinner {
      font-size: 16px;
      animation: spin 2s linear infinite;
      flex-shrink: 0;
    }
    .nav-check {
      font-size: 18px;
      color: #4ade80;
      flex-shrink: 0;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .answer-section { 
      background: #0f131a; 
      border: 1px solid #1d2735; 
      border-radius: 12px; 
      padding: 20px; 
      margin-bottom: 20px;
      line-height: 1.7;
    }
    .answer-text { color: #e9eef5; font-size: 15px; }
    
    .typing-indicator { 
      display: flex; 
      gap: 4px; 
      margin-top: 12px; 
    }
    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #5b7a9f;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }

    .sources-section { 
      background: #0f131a; 
      border: 1px solid #1d2735; 
      border-radius: 12px; 
      padding: 20px; 
      margin-bottom: 20px;
    }
    .sources-section h3 { 
      color: #c9d7ff; 
      font-size: 16px; 
      margin: 0 0 16px 0; 
      font-weight: 600;
    }
    .source-item { 
      display: flex; 
      gap: 12px; 
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #1d2735;
    }
    .source-item:last-child { 
      border-bottom: none; 
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .source-num { 
      color: #5b7a9f; 
      font-size: 13px; 
      font-weight: 600;
      min-width: 28px;
    }
    .source-content { flex: 1; }
    .source-title { 
      color: #a8c5f0; 
      text-decoration: none; 
      font-size: 14px; 
      font-weight: 500;
      display: block;
      margin-bottom: 4px;
      transition: color 0.2s;
    }
    .source-title:hover { 
      color: #c9d7ff; 
      text-decoration: underline; 
    }
    .source-snippet { 
      color: #9fb0c0; 
      font-size: 13px; 
      line-height: 1.5;
    }

    /* Share section */
    .share-section {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .share-btn {
      background: #0e3e9b;
      border: none;
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .share-btn:hover { background: #1653c4; }
    .share-icon { font-size: 16px; }
    .share-status {
      color: #5fc88f;
      font-size: 13px;
      animation: fadeOut 2s ease-out forwards;
    }
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }

    /* Timeline details (collapsible) */
    .timeline-details { 
      margin-top: 20px; 
      background: #0f131a; 
      border: 1px solid #1d2735; 
      border-radius: 12px; 
      padding: 16px;
    }
    .timeline-details summary { 
      cursor: pointer; 
      color: #8b9db5; 
      font-size: 14px;
      list-style: none;
      transition: color 0.2s;
    }
    .timeline-details summary::-webkit-details-marker { display: none; }
    .timeline-details summary:hover { 
      color: #a8c5f0;
      text-decoration: underline; 
    }
    
    .timeline { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
    .card { background:#0b0f14; border:1px solid #1d2735; border-radius:8px; padding:10px; }
    .card a { 
      color: #a8c5f0; 
      text-decoration: none; 
      transition: color 0.2s;
    }
    .card a:hover { 
      color: #c9d7ff; 
      text-decoration: underline; 
    }
    .status { display:flex; align-items:center; gap:8px; }
    .chip { background:#1d2735; color:#c9d7ff; padding:4px 8px; border-radius:999px; font-size:12px; }
    .chip.purple { background:#4a2c75; }
    .chip.blue { background:#0e3e9b; }
    .chip.green { background:#0e6b36; }
    .frame { background:#0b0f14; border:1px solid #1d2735; border-radius:8px; overflow:hidden; }
    .frame img { width:100%; display:block; }
    .caption { font-size:12px; color:#9fb0c0; margin-top:6px; }
    
    .deals { margin-top: 24px; }
    .deals h3 { color: #c9d7ff; font-size: 18px; margin-bottom: 16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
    .deal { background:#0f131a; border:1px solid #1d2735; border-radius:12px; padding:12px; }
    .deal a {
      color: #a8c5f0;
      text-decoration: none;
      transition: color 0.2s;
    }
    .deal a:hover {
      color: #c9d7ff;
      text-decoration: underline;
    }
    .kv { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin:8px 0; }
    .addr { color:#99a9bd; font-size:13px; }
    img { border-radius:8px; margin-top:8px; }
  `]
})
export class App {
  q = signal('');
  busy = signal(false);
  cards = signal<Card[]>([]);
  deals = signal<any[]>([]);
  sources = signal<Source[]>([]);
  answer = signal<string>('');
  answerComplete = signal(false);
  shareStatus = signal<string>('');
  typingPlaceholder = signal<string>('Ask a question...');
  private typingInterval: any = null;
  private isTypingActive = true;
  private currentExampleIndex = 0;

  private exampleQueries: string[] = [];
  private allPrompts: string[] = [];

  constructor(private svc: AgentService) {
    this.loadPrompts();
  }

  private async loadPrompts() {
    try {
      const response = await fetch('/assets/search-prompts.json');
      const data = await response.json();
      
      // Flatten all categories into one array
      this.allPrompts = Object.values(data.categories).flat() as string[];
      
      // Randomly select 20 prompts for the typing animation
      this.exampleQueries = this.getRandomPrompts(20);
      
      console.log(`[prompts] Loaded ${this.allPrompts.length} prompts from ${Object.keys(data.categories).length} categories`);
      
      // Start animation after prompts are loaded
      this.startTypingAnimation();
    } catch (error) {
      console.error('[prompts] Failed to load prompts, using fallback:', error);
      // Fallback prompts
      this.exampleQueries = [
        'Find single-tenant NNN retail in Dallas, 4–6% cap, price $4M–$6M',
        'CVS pharmacy properties for sale in Texas',
        'Medical office buildings with hospital affiliation, cap rate 6-8%',
      ];
      this.startTypingAnimation();
    }
  }

  private getRandomPrompts(count: number): string[] {
    const shuffled = [...this.allPrompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  ngOnDestroy() {
    this.stopTyping();
  }

  private startTypingAnimation() {
    let queryIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingSpeed = 80;
    const deletingSpeed = 40;
    const pauseBeforeDelete = 2000;
    const pauseBeforeNext = 500;

    const type = () => {
      if (!this.isTypingActive) return;

      const currentQuery = this.exampleQueries[queryIndex];
      this.currentExampleIndex = queryIndex; // Track current example
      
      if (!isDeleting && charIndex <= currentQuery.length) {
        // Typing forward
        this.typingPlaceholder.set(currentQuery.substring(0, charIndex) + '|');
        charIndex++;
        
        if (charIndex > currentQuery.length) {
          // Finished typing, pause then start deleting
          setTimeout(() => {
            isDeleting = true;
            type();
          }, pauseBeforeDelete);
          return;
        }
      } else if (isDeleting && charIndex > 0) {
        // Deleting backward
        charIndex--;
        this.typingPlaceholder.set(currentQuery.substring(0, charIndex) + '|');
      } else if (isDeleting && charIndex === 0) {
        // Finished deleting, move to next query
        isDeleting = false;
        queryIndex = (queryIndex + 1) % this.exampleQueries.length;
        setTimeout(type, pauseBeforeNext);
        return;
      }
      
      const speed = isDeleting ? deletingSpeed : typingSpeed;
      this.typingInterval = setTimeout(type, speed);
    };

    type();
  }

  stopTyping() {
    this.isTypingActive = false;
    if (this.typingInterval) {
      clearTimeout(this.typingInterval);
      this.typingInterval = null;
    }
  }

  async shareResults() {
    const query = this.q();
    const answer = this.answer();
    const sources = this.sources();
    const deals = this.deals();
    
    // Build shareable text
    let shareText = `Query: ${query}\n\n`;
    shareText += `Answer:\n${answer.replace(/<[^>]*>/g, '')}\n\n`;
    
    if (sources.length) {
      shareText += `Sources:\n`;
      sources.forEach(src => {
        shareText += `[${src.id}] ${src.title}\n${src.url}\n\n`;
      });
    }
    
    if (deals.length) {
      shareText += `\nDeals Found:\n`;
      deals.forEach(deal => {
        shareText += `- ${deal.title || 'Property'}\n`;
        shareText += `  Address: ${deal.address || 'N/A'}\n`;
        shareText += `  Price: $${deal.askingPrice?.toLocaleString() || 'N/A'}\n`;
        shareText += `  Cap Rate: ${((deal.capRate || deal.underwrite?.capRate) * 100)?.toFixed(2) || 'N/A'}%\n`;
        shareText += `  URL: ${deal.url}\n\n`;
      });
    }
    
    try {
      // Try Web Share API first (mobile/modern browsers)
      if (navigator.share) {
        await navigator.share({
          title: 'RealEstate Deal Agent Results',
          text: shareText,
        });
        this.shareStatus.set('✓ Shared!');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareText);
        this.shareStatus.set('✓ Copied to clipboard!');
      }
      
      // Clear status after 2 seconds
      setTimeout(() => this.shareStatus.set(''), 2000);
    } catch (err) {
      console.error('Share failed:', err);
      this.shareStatus.set('✗ Share failed');
      setTimeout(() => this.shareStatus.set(''), 2000);
    }
  }

  async run() {
    let query = this.q().trim();
    
    // If empty, use the current example query from animation
    if (!query) {
      query = this.exampleQueries[this.currentExampleIndex];
      this.q.set(query); // Fill the input with the example
      this.stopTyping(); // Stop animation
    }
    
    this.cards.set([]);
    this.deals.set([]);
    this.sources.set([]);
    this.answer.set('');
    this.answerComplete.set(false);
    this.shareStatus.set('');
    this.busy.set(true);
    try {
      const runId = await this.svc.startRun(query);
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
      alert('Run failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }

  onEvent(ev: AgentEvent) {
    const push = (c: Card) => this.cards.update(arr => [...arr, c]);
    switch (ev.kind) {
      case 'thinking':
        push({ kind:'thinking', label: ev['text'], t:ev.t });
        break;
      case 'source_found':
        this.sources.update(arr => [...arr, ev['source']]);
        push({ kind:'source', source: ev['source'], t:ev.t });
        break;
      case 'deal_found':
        // ✅ Progressive streaming: add deal immediately as it arrives
        this.deals.update(arr => [...arr, ev['deal']]);
        push({ kind:'thinking', label: `✓ Found property ${ev['count']}: ${ev['deal'].title}`, t:ev.t });
        break;
      case 'answer_chunk':
        this.answer.update(curr => curr + ev['text']);
        break;
      case 'answer_complete':
        this.answerComplete.set(true);
        push({ kind:'answer', label: this.answer(), t:ev.t });
        break;
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
