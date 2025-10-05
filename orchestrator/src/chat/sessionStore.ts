// src/chat/sessionStore.ts
// Multi-turn conversation memory with context persistence

type Msg = { 
  role: "user" | "assistant" | "tool" | "system"; 
  content: string;
  timestamp?: number;
};

type Session = { 
  history: Msg[];
  context?: any;
  updatedAt: number;
  createdAt: number;
};

// In-memory session store (use Redis for production multi-instance deployments)
const SESSIONS: Map<string, Session> = new Map();

// Session TTL: 24 hours
const SESSION_TTL = 24 * 60 * 60 * 1000;

/**
 * Get or create a session
 * @param id Session ID (typically user ID or browser fingerprint)
 * @param maxTurns Maximum number of conversation turns to keep (default 16)
 */
export function getSession(id: string, maxTurns = 16): Session {
  cleanupExpiredSessions();
  
  let session = SESSIONS.get(id);
  
  if (!session) {
    session = {
      history: [],
      context: {},
      updatedAt: Date.now(),
      createdAt: Date.now()
    };
    SESSIONS.set(id, session);
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
}

/**
 * Update session context (portfolio data, search results, etc.)
 */
export function updateSessionContext(id: string, context: any) {
  const session = getSession(id);
  session.context = { ...(session.context || {}), ...context };
  session.updatedAt = Date.now();
  SESSIONS.set(id, session);
}

/**
 * Clear session history (keep context)
 */
export function clearSessionHistory(id: string) {
  const session = SESSIONS.get(id);
  if (session) {
    session.history = [];
    session.updatedAt = Date.now();
    SESSIONS.set(id, session);
  }
}

/**
 * Delete entire session
 */
export function deleteSession(id: string) {
  SESSIONS.delete(id);
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
    hasContext: !!session.context && Object.keys(session.context).length > 0
  };
}

/**
 * Cleanup expired sessions (run periodically)
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
 * Export session for persistence (e.g., to database)
 */
export function exportSession(id: string): Session | null {
  return SESSIONS.get(id) || null;
}

/**
 * Import session from persistence
 */
export function importSession(id: string, session: Session) {
  SESSIONS.set(id, session);
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
