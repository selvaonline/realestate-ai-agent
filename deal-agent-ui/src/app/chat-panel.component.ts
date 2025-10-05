import { Component, Input, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { VoiceInputComponent } from './voice-input.component';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolUsed?: string;
  toolResult?: any;
  timestamp?: number;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, VoiceInputComponent],
  template: `
    <div class="chat-panel" [class.expanded]="isExpanded()">
      <!-- Chat Toggle Button -->
      <button class="chat-toggle" (click)="toggleChat()" [class.has-unread]="hasUnread()">
        <span class="chat-icon">{{ isExpanded() ? '✕' : '💬' }}</span>
        <span class="chat-label">{{ isExpanded() ? 'Close' : 'Ask AI' }}</span>
        <span class="unread-badge" *ngIf="hasUnread()">{{ unreadCount() }}</span>
      </button>

      <!-- Chat Window -->
      <div class="chat-window" *ngIf="isExpanded()">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-title">
            <span class="chat-title-icon">🤖</span>
            <span>DealSense Chat</span>
          </div>
          <div class="chat-subtitle">Ask about deals, scores, or run new searches</div>
        </div>

        <!-- Messages -->
        <div class="chat-messages" #messagesContainer>
          <div *ngFor="let msg of messages()" 
               class="chat-message" 
               [class.user]="msg.role === 'user'"
               [class.assistant]="msg.role === 'assistant'">
            
            <div class="message-avatar">
              {{ msg.role === 'user' ? '👤' : '🤖' }}
            </div>
            
            <div class="message-content">
              <div class="message-text" [innerHTML]="formatMessage(msg.content)"></div>
              
              <!-- Tool usage indicator -->
              <div class="tool-indicator" *ngIf="msg.toolUsed">
                <span class="tool-icon">🔧</span>
                <span class="tool-name">{{ formatToolName(msg.toolUsed) }}</span>
              </div>

              <!-- Timestamp -->
              <div class="message-time">
                {{ formatTime(msg.timestamp || getCurrentTime()) }}
              </div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div class="chat-message assistant" *ngIf="isLoading()">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions" *ngIf="!messages().length || showQuickActions()">
          <div class="quick-actions-title">Quick Actions</div>
          <div class="quick-actions-grid">
            <button *ngFor="let action of quickActions" 
                    class="quick-action-btn"
                    (click)="sendQuickAction(action)"
                    [disabled]="isLoading()">
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-label">{{ action.label }}</span>
            </button>
          </div>
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <app-voice-input (result)="onVoiceResult($event)"></app-voice-input>
          <textarea #inputField
                    [(ngModel)]="inputText"
                    (keydown)="onEnterKey($event)"
                    placeholder="Ask about deals, scores, or run a search..."
                    rows="1"
                    [disabled]="isLoading()"></textarea>
          <button class="send-btn" 
                  (click)="sendMessage()"
                  [disabled]="!inputText.trim() || isLoading()">
            <span class="send-icon">{{ isLoading() ? '⏳' : '➤' }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
    }

    .chat-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
      position: relative;
    }

    .chat-toggle:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
    }

    .chat-toggle.has-unread {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
      50% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.7); }
    }

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 700;
    }

    .chat-window {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 420px;
      height: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .chat-header {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .chat-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .chat-subtitle {
      font-size: 13px;
      opacity: 0.9;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chat-message {
      display: flex;
      gap: 12px;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
      background: #f3f4f6;
    }

    .chat-message.user .message-avatar {
      background: #dbeafe;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-text {
      background: #f3f4f6;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.6;
      word-wrap: break-word;
    }

    .chat-message.user .message-text {
      background: #dbeafe;
      color: #1e40af;
    }

    .tool-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 6px 12px;
      background: #fef3c7;
      border-radius: 8px;
      font-size: 12px;
      color: #92400e;
    }

    .message-time {
      margin-top: 4px;
      font-size: 11px;
      color: #9ca3af;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ca3af;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-10px); }
    }

    .quick-actions {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .quick-actions-title {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .quick-actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .quick-action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .quick-action-btn:hover:not(:disabled) {
      background: #f3f4f6;
      border-color: #667eea;
      transform: translateY(-1px);
    }

    .quick-action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .action-icon {
      font-size: 16px;
    }

    .action-label {
      font-weight: 500;
      color: #374151;
    }

    .chat-input-area {
      display: flex;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: white;
    }

    .chat-input-area textarea {
      flex: 1;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      max-height: 120px;
      transition: border-color 0.2s;
    }

    .chat-input-area textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .send-btn {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .send-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-icon {
      font-size: 18px;
    }

    /* Scrollbar styling */
    .chat-messages::-webkit-scrollbar {
      width: 6px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: #f3f4f6;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
  `]
})
export class ChatPanelComponent {
  @Input() getContext?: () => any;
  @ViewChild('messagesContainer') messagesContainer?: ElementRef;
  @ViewChild('inputField') inputField?: ElementRef;

  isExpanded = signal(false);
  messages = signal<ChatMessage[]>([]);
  inputText = '';
  isLoading = signal(false);
  hasUnread = signal(false);
  unreadCount = signal(0);
  showQuickActions = signal(true);
  
  // Session ID for multi-turn memory
  private sessionId = crypto.randomUUID();

  quickActions: QuickAction[] = [
    { label: 'Explain Market Risk', prompt: 'Why is the Market Risk score what it is? Explain the factors.', icon: '📊' },
    { label: 'Top Deals', prompt: 'Show me the premium opportunities from the current results.', icon: '⭐' },
    { label: 'Create IC Memo', prompt: 'Create an IC memo for the top deal.', icon: '📝' },
    { label: 'New Search', prompt: 'Find medical office buildings with hospital affiliation, cap rate 6-8%.', icon: '🔍' }
  ];

  constructor(private http: HttpClient) {
    // Welcome message
    this.messages.set([{
      role: 'assistant',
      content: 'Hi! I\'m DealSense Chat. Ask me about deals, scores, or run a new search. How can I help you today?',
      timestamp: Date.now()
    }]);
  }

  toggleChat() {
    this.isExpanded.update(v => !v);
    if (this.isExpanded()) {
      this.hasUnread.set(false);
      this.unreadCount.set(0);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.isLoading()) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    this.messages.update(msgs => [...msgs, userMessage]);
    this.inputText = '';
    this.showQuickActions.set(false);
    
    setTimeout(() => this.scrollToBottom(), 50);

    // Send to backend
    this.isLoading.set(true);
    try {
      // Get fresh context from parent component
      const currentContext = this.getContext ? this.getContext() : {};
      
      console.log('[chat] Sending context:', currentContext);
      
      const response = await this.http.post<any>(`${environment.apiUrl}/chat/enhanced`, {
        sessionId: this.sessionId,
        user: text,
        context: currentContext
      }).toPromise();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content || 'I received your request.',
        toolUsed: response.toolUsed,
        toolResult: response.toolResult,
        timestamp: Date.now()
      };
      
      this.messages.update(msgs => [...msgs, assistantMessage]);
      
      if (!this.isExpanded()) {
        this.hasUnread.set(true);
        this.unreadCount.update(c => c + 1);
      }

      setTimeout(() => this.scrollToBottom(), 50);
    } catch (error: any) {
      console.error('[chat] Error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.error?.error || error.message || 'Unknown error'}. Please try again.`,
        timestamp: Date.now()
      };
      this.messages.update(msgs => [...msgs, errorMessage]);
    } finally {
      this.isLoading.set(false);
    }
  }

  sendQuickAction(action: QuickAction) {
    this.inputText = action.prompt;
    this.sendMessage();
  }

  onVoiceResult(text: string) {
    this.inputText = text;
    // Optionally auto-send after voice input
    // this.sendMessage();
  }

  onEnterKey(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatMessage(content: string): string {
    // Convert markdown-style formatting to HTML
    let formatted = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(\d+)\]/g, '<sup class="citation">[$1]</sup>')
      .replace(/\n/g, '<br>');
    
    return formatted;
  }

  formatToolName(toolName: string): string {
    const names: Record<string, string> = {
      'web_search': 'Web Search',
      'pe_score_pro': 'PE Scoring',
      'risk_blender': 'Risk Analysis',
      'generate_ic_memo': 'IC Memo Generated',
      'analyze_context': 'Context Analysis'
    };
    return names[toolName] || toolName;
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  getCurrentTime(): number {
    return Date.now();
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
