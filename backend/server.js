/**
 * Visual Authentication Gateway
 * Cybersecurity SaaS for Banking - Anti-Phishing & Anti-RAT Protection
 * 
 * Features:
 * - SHA-256 hashed visual secrets
 * - Session-based authentication (60s expiry)
 * - Single-use sessions
 * - CORS enabled for bank integrations
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../ui')));

// ============================================
// SECURITY CONFIGURATION
// ============================================

// Session storage (in production, use Redis)
const sessions = new Map();

// Session timeout: 60 seconds
const SESSION_TIMEOUT_MS = 60000;

// Demo user database with SHA-256 hashed visual secrets
// User U123 secret: 🍎 → 🎧 → 🔥
const USER_DATABASE = {
  'U123': {
    userId: 'U123',
    // SHA-256 hash of "🍎|🎧|🔥"
    secretHash: '71d9d0d740e5d44281516dc085c9ad814e4ea9570dcdcfd01cbb1971862113c8',
    createdAt: new Date().toISOString()
  }
};

// Available emojis for the grid
const EMOJI_POOL = [
  '🍎', '🎧', '🔥', '🚀', '⭐', '🔒',
  '🔑', '💎', '🎯', '🌟', '⚡', '🔐'
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate cryptographically secure random UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate SHA-256 hash of visual pattern
 * @param {string[]} pattern - Array of emojis
 * @returns {string} - SHA-256 hash
 */
function hashVisualPattern(pattern) {
  const patternString = pattern.join('|');
  return crypto.createHash('sha256').update(patternString).digest('hex');
}

/**
 * Shuffle array using Fisher-Yates algorithm with crypto-secure random
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a shuffled 3x3 grid for a session
 * Ensures the secret pattern emojis are included
 * @param {string[]} secretPattern - User's secret pattern
 * @returns {string[]} - 9 shuffled emojis
 */
function generateShuffledGrid(secretPattern) {
  // Start with secret pattern emojis
  const gridEmojis = [...secretPattern];
  
  // Fill remaining slots with random emojis from pool (excluding secret ones)
  const availableEmojis = EMOJI_POOL.filter(e => !secretPattern.includes(e));
  
  while (gridEmojis.length < 9) {
    const randomIndex = crypto.randomInt(0, availableEmojis.length);
    const emoji = availableEmojis[randomIndex];
    if (!gridEmojis.includes(emoji)) {
      gridEmojis.push(emoji);
    }
  }
  
  // Shuffle the grid
  return shuffleArray(gridEmojis);
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      console.log(`[CLEANUP] Expired session removed: ${sessionId}`);
    }
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupExpiredSessions, 30000);

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /start-auth
 * Initialize authentication session
 * 
 * Request: { "user_id": "U123" }
 * Response: { "session_id": "UUID", "grid": [...] }
 */
app.post('/start-auth', (req, res) => {
  try {
    const { user_id } = req.body;

    // Validate input
    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'user_id is required and must be a string'
      });
    }

    // Check if user exists
    const user = USER_DATABASE[user_id];
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found in authentication system'
      });
    }

    // Generate unique session ID
    const sessionId = generateUUID();

    // Generate shuffled grid (include secret pattern emojis)
    // For demo: reconstruct secret from hash check (in production, store pattern securely)
    const secretPattern = ['🍎', '🎧', '🔥']; // Demo secret for U123
    const shuffledGrid = generateShuffledGrid(secretPattern);

    // Create session with expiry
    const now = Date.now();
    const session = {
      sessionId,
      userId: user_id,
      secretHash: user.secretHash,
      grid: shuffledGrid,
      createdAt: now,
      expiresAt: now + SESSION_TIMEOUT_MS,
      used: false,
      attempts: 0,
      maxAttempts: 3
    };

    // Store session
    sessions.set(sessionId, session);

    console.log(`[AUTH START] Session created: ${sessionId} for user: ${user_id}`);
    console.log(`[AUTH START] Session expires in ${SESSION_TIMEOUT_MS / 1000} seconds`);

    // Return session info (don't expose secret)
    return res.status(200).json({
      session_id: sessionId,
      grid: shuffledGrid,
      expires_in: SESSION_TIMEOUT_MS / 1000
    });

  } catch (error) {
    console.error('[ERROR] /start-auth:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication system error'
    });
  }
});

/**
 * POST /verify-auth
 * Verify visual pattern authentication
 * 
 * Request: { "session_id": "UUID", "input": ["🍎","🎧","🔥"] }
 * Response: { "result": "PASS" | "FAIL" }
 */
app.post('/verify-auth', (req, res) => {
  try {
    const { session_id, input } = req.body;

    // Validate input
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'session_id is required'
      });
    }

    if (!input || !Array.isArray(input) || input.length !== 3) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'input must be an array of exactly 3 emojis'
      });
    }

    // Retrieve session
    const session = sessions.get(session_id);

    // Check if session exists
    if (!session) {
      console.log(`[VERIFY FAIL] Session not found: ${session_id}`);
      return res.status(401).json({
        result: 'FAIL',
        error: 'INVALID_SESSION',
        message: 'Session not found or expired'
      });
    }

    // Check if session already used
    if (session.used) {
      console.log(`[VERIFY FAIL] Session already used: ${session_id}`);
      sessions.delete(session_id); // Delete used session
      return res.status(401).json({
        result: 'FAIL',
        error: 'SESSION_USED',
        message: 'Session has already been used'
      });
    }

    // Check if session expired
    const now = Date.now();
    if (now > session.expiresAt) {
      console.log(`[VERIFY FAIL] Session expired: ${session_id}`);
      sessions.delete(session_id);
      return res.status(401).json({
        result: 'FAIL',
        error: 'SESSION_EXPIRED',
        message: 'Session has expired'
      });
    }

    // Check attempt limit
    if (session.attempts >= session.maxAttempts) {
      console.log(`[VERIFY FAIL] Max attempts reached: ${session_id}`);
      sessions.delete(session_id);
      return res.status(401).json({
        result: 'FAIL',
        error: 'MAX_ATTEMPTS',
        message: 'Maximum verification attempts exceeded'
      });
    }

    // Increment attempt counter
    session.attempts++;

    // Hash the input pattern
    const inputHash = hashVisualPattern(input);

    // Compare with stored secret hash
    const isMatch = inputHash === session.secretHash;

    if (isMatch) {
      // Mark session as used (single-use)
      session.used = true;
      sessions.delete(session_id);

      console.log(`[VERIFY PASS] Authentication successful: ${session_id}`);
      console.log(`[VERIFY PASS] User: ${session.userId}`);

      return res.status(200).json({
        result: 'PASS',
        user_id: session.userId,
        verified_at: new Date().toISOString()
      });
    } else {
      console.log(`[VERIFY FAIL] Pattern mismatch: ${session_id}`);
      console.log(`[VERIFY FAIL] Attempt ${session.attempts}/${session.maxAttempts}`);

      // If max attempts reached, delete session
      if (session.attempts >= session.maxAttempts) {
        sessions.delete(session_id);
        return res.status(401).json({
          result: 'FAIL',
          error: 'MAX_ATTEMPTS',
          message: 'Maximum verification attempts exceeded'
        });
      }

      return res.status(401).json({
        result: 'FAIL',
        error: 'INVALID_PATTERN',
        message: 'Visual pattern does not match',
        attempts_remaining: session.maxAttempts - session.attempts
      });
    }

  } catch (error) {
    console.error('[ERROR] /verify-auth:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Verification system error'
    });
  }
});

/**
 * GET /session-status/:sessionId
 * Check session status (for debugging)
 */
app.get('/session-status/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({
      exists: false,
      message: 'Session not found or expired'
    });
  }

  const now = Date.now();
  const timeRemaining = Math.max(0, session.expiresAt - now);

  return res.status(200).json({
    exists: true,
    session_id: session.sessionId,
    user_id: session.userId,
    created_at: new Date(session.createdAt).toISOString(),
    expires_at: new Date(session.expiresAt).toISOString(),
    time_remaining_seconds: Math.floor(timeRemaining / 1000),
    used: session.used,
    attempts: session.attempts,
    max_attempts: session.maxAttempts
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Visual Authentication Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    active_sessions: sessions.size
  });
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../ui/index.html'));
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  Visual Authentication Gateway');
  console.log('  Cybersecurity SaaS for Banking');
  console.log('='.repeat(60));
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('  Security Features:');
  console.log('  ✓ SHA-256 hashed visual secrets');
  console.log('  ✓ 60-second session expiry');
  console.log('  ✓ Single-use sessions');
  console.log('  ✓ CORS enabled');
  console.log('  ✓ Rate limiting (3 attempts per session)');
  console.log('='.repeat(60));
});

module.exports = app;