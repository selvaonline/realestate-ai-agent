// src/chat/sessionStore.ts
// Multi-turn conversation memory with file-based persistence and investment criteria

import fs from "node:fs";
import path from "node:path";
import type { InvestmentCriteria, PortfolioEntry } from "../lib/agentTypes.js";

type Msg = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp?: number;
};

type Session = {
  history: Msg[];
  context?: any;
  criteria: InvestmentCriteria;
  portfolio: PortfolioEntry[];
  updatedAt: number;
  createdAt: number;
  version: number;
};

// ── File-based persistence ───────────────────────────────────────────────────

const SESSIONS_DIR = path.join(process.cwd(), ".sessions");

// Ensure directory exists
try {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    console.log("[sessionStore] Created .sessions/ directory");
  }
} catch (e: any) {
  console.error("[sessionStore] Failed to create .sessions/ directory:", e.message);
}

function loadFromDisk(id: string): Session | null {
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    // Migrate old sessions that lack criteria/portfolio
    if (!data.criteria) data.criteria = {};
    if (!data.portfolio) data.portfolio = [];
    if (!data.version) data.version = 1;
    return data as Session;
  } catch {
    return null;
  }
}

function saveToDisk(id: string, session: Session): void {
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    const tmpPath = `${filePath}.tmp`;
    const data = JSON.stringify(session, null, 2);
    fs.writeFileSync(tmpPath, data, "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (e: any) {
    console.error(`[sessionStore] Failed to persist ${id}:`, e.message);
  }
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const SESSIONS: Map<string, Session> = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000;

function createEmptySession(): Session {
  return {
    history: [],
    context: {},
    criteria: {},
    portfolio: [],
    updatedAt: Date.now(),
    createdAt: Date.now(),
    version: 1,
  };
}

/**
 * Get or create a session (lazy-loads from disk on first access)
 */
export function getSession(id: string, maxTurns = 16): Session {
  cleanupExpiredSessions();

  let session: Session | undefined = SESSIONS.get(id);

  if (!session) {
    // Try loading from disk
    const fromDisk = loadFromDisk(id);
    session = fromDisk ?? undefined;
    if (session) {
      SESSIONS.set(id, session);
    } else {
      session = createEmptySession();
      SESSIONS.set(id, session);
    }
  }

  // Trim history to last N*2 messages (user + assistant pairs)
  if (session.history.length > maxTurns * 2) {
    session.history = session.history.slice(-maxTurns * 2);
  }

  return session;
}

/**
 * Append a message to session history
 */
export function appendToSession(id: string, msg: Msg) {
  const session = getSession(id);
  session.history.push({
    ...msg,
    timestamp: msg.timestamp || Date.now()
  });
  session.updatedAt = Date.now();
  SESSIONS.set(id, session);
  saveToDisk(id, session);
}

/**
 * Update session context (portfolio data, search results, etc.)
 */
export function updateSessionContext(id: string, context: any) {
  const session = getSession(id);
  session.context = { ...(session.context || {}), ...context };
  session.updatedAt = Date.now();
  SESSIONS.set(id, session);
  saveToDisk(id, session);
}

/**
 * Update investment criteria for a session
 */
export function updateSessionCriteria(id: string, criteria: Partial<InvestmentCriteria>) {
  const session = getSession(id);
  session.criteria = { ...session.criteria, ...criteria, lastUpdated: Date.now() };
  session.updatedAt = Date.now();
  SESSIONS.set(id, session);
  saveToDisk(id, session);
}

/**
 * Add a property to the session portfolio
 */
export function addToPortfolio(id: string, entry: PortfolioEntry) {
  const session = getSession(id);
  // Avoid duplicates by URL
  if (!session.portfolio.find(p => p.url === entry.url)) {
    session.portfolio.push(entry);
    session.updatedAt = Date.now();
    SESSIONS.set(id, session);
    saveToDisk(id, session);
  }
}

/**
 * Get session as SessionData for the agentic loop
 */
export function getSessionData(id: string) {
  const session = getSession(id);
  return {
    id,
    history: session.history.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || 0,
    })),
    context: session.context || {},
    criteria: session.criteria || {},
    portfolio: session.portfolio || [],
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    version: session.version || 1,
  };
}

/**
 * Clear session history (keep context, criteria, portfolio)
 */
export function clearSessionHistory(id: string) {
  const session = SESSIONS.get(id);
  if (session) {
    session.history = [];
    session.updatedAt = Date.now();
    SESSIONS.set(id, session);
    saveToDisk(id, session);
  }
}

/**
 * Delete entire session (memory + disk)
 */
export function deleteSession(id: string) {
  SESSIONS.delete(id);
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

/**
 * Get all active session IDs
 */
export function getActiveSessions(): string[] {
  return Array.from(SESSIONS.keys());
}

/**
 * Get session stats
 */
export function getSessionStats(id: string) {
  const session = SESSIONS.get(id);
  if (!session) return null;

  return {
    messageCount: session.history.length,
    age: Date.now() - session.createdAt,
    lastActivity: Date.now() - session.updatedAt,
    hasContext: !!session.context && Object.keys(session.context).length > 0,
    hasCriteria: Object.keys(session.criteria || {}).length > 0,
    portfolioSize: (session.portfolio || []).length,
  };
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of SESSIONS.entries()) {
    if (now - session.updatedAt > SESSION_TTL) {
      SESSIONS.delete(id);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/**
 * Export session for persistence
 */
export function exportSession(id: string): Session | null {
  return SESSIONS.get(id) || null;
}

/**
 * Import session from persistence
 */
export function importSession(id: string, session: Session) {
  SESSIONS.set(id, session);
  saveToDisk(id, session);
}

/**
 * Get conversation summary for a session
 */
export function getConversationSummary(id: string): string {
  const session = SESSIONS.get(id);
  if (!session || session.history.length === 0) {
    return "No conversation history";
  }

  const userMessages = session.history.filter(m => m.role === "user").length;
  const assistantMessages = session.history.filter(m => m.role === "assistant").length;
  const duration = Date.now() - session.createdAt;
  const durationMin = Math.round(duration / 60000);

  return `${userMessages} user messages, ${assistantMessages} assistant responses over ${durationMin} minutes`;
}
