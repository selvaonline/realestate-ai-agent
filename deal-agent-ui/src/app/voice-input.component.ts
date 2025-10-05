// src/app/voice-input.component.ts
// Voice input using Web Speech API

import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voice-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      *ngIf="isSupported()"
      class="voice-btn"
      [class.recording]="isRecording()"
      (click)="toggleRecording()"
      [disabled]="!isSupported()"
      [title]="isRecording() ? 'Stop recording' : 'Speak your query'">
      <span class="voice-icon">{{ isRecording() ? '🔴' : '🎙️' }}</span>
      <span class="voice-label">{{ isRecording() ? 'Listening...' : 'Voice' }}</span>
    </button>
    <div *ngIf="!isSupported()" class="voice-unsupported">
      Voice input not supported in this browser
    </div>
  `,
  styles: [`
    .voice-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: 1px solid #d0d5dd;
      border-radius: 8px;
      background: white;
      color: #344054;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .voice-btn:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #667eea;
    }

    .voice-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .voice-btn.recording {
      background: #fef3f2;
      border-color: #ef4444;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
      }
    }

    .voice-icon {
      font-size: 18px;
      line-height: 1;
    }

    .voice-label {
      font-size: 13px;
    }

    .voice-unsupported {
      font-size: 12px;
      color: #6b7280;
      padding: 8px;
    }
  `]
})
export class VoiceInputComponent {
  @Output() result = new EventEmitter<string>();
  
  isSupported = signal(false);
  isRecording = signal(false);
  
  private recognition: any = null;

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[voice-input] Web Speech API not supported');
      this.isSupported.set(false);
      return;
    }

    this.isSupported.set(true);

    // Initialize recognition
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;

    // Handle results
    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('[voice-input] Recognized:', transcript);
      this.result.emit(transcript);
      this.isRecording.set(false);
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('[voice-input] Error:', event.error);
      this.isRecording.set(false);
      
      if (event.error === 'no-speech') {
        console.warn('[voice-input] No speech detected');
      } else if (event.error === 'not-allowed') {
        console.error('[voice-input] Microphone permission denied');
        alert('Please allow microphone access to use voice input');
      }
    };

    // Handle end
    this.recognition.onend = () => {
      this.isRecording.set(false);
    };
  }

  toggleRecording() {
    if (!this.recognition) return;

    if (this.isRecording()) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private startRecording() {
    try {
      this.recognition.start();
      this.isRecording.set(true);
      console.log('[voice-input] Started recording');
    } catch (error) {
      console.error('[voice-input] Failed to start:', error);
      this.isRecording.set(false);
    }
  }

  private stopRecording() {
    try {
      this.recognition.stop();
      this.isRecording.set(false);
      console.log('[voice-input] Stopped recording');
    } catch (error) {
      console.error('[voice-input] Failed to stop:', error);
    }
  }

  ngOnDestroy() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }
}
