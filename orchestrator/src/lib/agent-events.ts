// src/lib/agent-events.ts
export type AgentEvent =
  | { kind: "run_started"; runId: string; query: string; t: number }
  | { kind: "status"; runId: string; label: string; note?: string; t: number } // e.g. "Setting up my desktop"
  | { kind: "nav"; runId: string; url: string; label: string; t: number }      // "Navigating to JSX website"
  | { kind: "wait"; runId: string; label: string; t: number }                  // "Waiting for search results"
  | { kind: "action"; runId: string; label: string; t: number }                // "Attempting booking"
  | { kind: "shot"; runId: string; label: string; b64: string; t: number }     // screenshot
  | { kind: "extracted"; runId: string; summary: Record<string, any>; t: number }
  | { kind: "fallback"; runId: string; label: string; t: number }
  | { kind: "thinking"; runId: string; text: string; t: number }               // Perplexity-style reasoning
  | { kind: "source_found"; runId: string; source: { id: number; title: string; url: string; snippet: string }; t: number }
  | { kind: "answer_chunk"; runId: string; text: string; t: number }           // Streaming answer
  | { kind: "answer_complete"; runId: string; t: number }
  | { kind: "tool_start"; runId: string; tool: string; input: string; t: number }    // Tool execution start
  | { kind: "tool_end"; runId: string; tool: string; success: boolean; duration: number; t: number }  // Tool execution end
  | { kind: "browse_start"; runId: string; url: string; t: number }            // Browser opening URL
  | { kind: "browse_cloudflare"; runId: string; passed: boolean; t: number }   // Cloudflare check result
  | { kind: "browse_extract"; runId: string; fields: string[]; t: number }     // Extraction progress
  | { kind: "run_finished"; runId: string; ok: boolean; t: number };
