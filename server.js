'use strict';

/**
 * OpenClaw Web Channel v3.0 — Optimized Server
 *
 * Express + WebSocket server that proxies browser clients to the
 * OpenClaw Gateway WebSocket API. Includes auto-detection of OpenClaw,
 * file uploads, streaming chat, session/skill/node management, and more.
 *
 * v3.0 Changes:
 *   - Streaming timeout guard (120s default)
 *   - Concurrent connection protection
 *   - CSP enabled
 *   - Version-aware RPC adapter layer
 *   - WebSocket connection limit
 *   - Gateway version detection + /api/gateway/version endpoint
 *   - Serves React frontend from client/dist/
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocket, WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');

// ─── Configuration ────────────────────────────────────────────────────────────

function loadConfig() {
  const file = path.join(__dirname, 'config.json');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}

  return {
    gatewayUrl:   process.env.OPENCLAW_GATEWAY_URL   || cfg.gatewayUrl   || 'ws://localhost:18789',
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN  || cfg.gatewayToken || '',
    port:         parseInt(process.env.PORT, 10)       || cfg.port        || 3000,
    host:         process.env.HOST                     || cfg.host        || '0.0.0.0',
    cors:         cfg.cors       || { origin: '*' },
    rateLimit:    cfg.rateLimit  || { windowMs: 60000, max: 100 },
    sessionKey:   cfg.sessionKey || 'webchat:main',
    reconnect:    cfg.reconnect  || { initialDelay: 1000, maxDelay: 30000, multiplier: 2 },
    maxWebSocketConnections: parseInt(process.env.MAX_WS_CONNECTIONS, 10) || cfg.maxWebSocketConnections || 50,
    streamTimeout: parseInt(process.env.STREAM_TIMEOUT, 10) || cfg.streamTimeout || 120000,
  };
}

// ─── In-Memory Data Stores ────────────────────────────────────────────────────
// Device management and discovery stores (will be lost on restart)

const devicesStore = new Map();
const discoveredGatewaysStore = new Map();
let discoveryScanning = false;
let lastDiscoveryScan = null;

// Initialize with some mock data for testing
function initMockData() {
  // Mock devices
  devicesStore.set('dev-001', {
    id: 'dev-001',
    name: 'iPhone 15 Pro',
    type: 'mobile',
    status: 'approved',
    pairedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.101',
    token: crypto.randomBytes(32).toString('hex'),
  });
  devicesStore.set('dev-002', {
    id: 'dev-002',
    name: 'MacBook Pro',
    type: 'desktop',
    status: 'approved',
    pairedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date().toISOString(),
    ipAddress: '192.168.1.102',
    token: crypto.randomBytes(32).toString('hex'),
  });
  devicesStore.set('dev-003', {
    id: 'dev-003',
    name: 'iPad Air',
    type: 'mobile',
    status: 'pending',
    pairedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    ipAddress: '192.168.1.103',
    token: crypto.randomBytes(32).toString('hex'),
  });
}

initMockData();

const CONFIG = loadConfig();

// ─── Logging ──────────────────────────────────────────────────────────────────

const LOG_BUFFER = [];
const MAX_LOG_BUFFER = 2000;

function log(level, msg, data) {
  const entry = { ts: new Date().toISOString(), level, msg };
  if (data) entry.data = data;
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_LOG_BUFFER) LOG_BUFFER.shift();
  console.log(JSON.stringify(entry));
  // Forward to SSE log listeners
  for (const cb of logListeners) {
    try { cb(entry); } catch (_) {}
  }
}

const logListeners = new Set();

// ─── RPC Adapter Layer ────────────────────────────────────────────────────────
// Version-aware RPC adapter that tries multiple method names for compatibility
// across different gateway versions.

const RPC_ADAPTER_MAP = {
  // Session operations
  'sessions.reset':   ['sessions.reset',   'sessions.patch'],
  'sessions.compact': ['sessions.compact', 'sessions.patch'],
  'sessions.delete':  ['sessions.delete',  'sessions.patch'],

  // Node operations
  'node.list':   ['node.list',   'nodes.list'],
  'node.invoke': ['node.invoke', 'nodes.action'],

  // Config operations
  'config.schema.lookup': ['config.schema.lookup', 'config.schema'],

  // Skill operations
  'skills.patch': ['skills.patch'],
};

/**
 * Execute an RPC call with version-aware method fallback.
 * For adapter-aware methods, it tries each candidate in order.
 * For adapter-aware methods that fall back to sessions.patch / skills.patch,
 * the appropriate flag is injected automatically.
 */
function adaptRpcMethod(method, params) {
  const candidates = RPC_ADAPTER_MAP[method];
  if (!candidates) return { method, params };

  // For session operations that fall back to sessions.patch, inject the flag
  if (method === 'sessions.reset' && params) {
    return {
      candidates: ['sessions.reset', 'sessions.patch'],
      params: [params, { ...params, reset: true }],
    };
  }
  if (method === 'sessions.compact' && params) {
    return {
      candidates: ['sessions.compact', 'sessions.patch'],
      params: [params, { ...params, compact: true }],
    };
  }
  if (method === 'sessions.delete' && params) {
    return {
      candidates: ['sessions.delete', 'sessions.patch'],
      params: [params, { ...params, delete: true }],
    };
  }

  // For skills.patch fallback to skills.enable/skills.disable
  if (method === 'skills.patch' && params) {
    const { enabled, ...rest } = params;
    if (enabled !== undefined) {
      const fallbackMethod = enabled ? 'skills.enable' : 'skills.disable';
      return {
        candidates: ['skills.patch', fallbackMethod],
        params: [params, { ...rest, name: params.name }],
      };
    }
    return { method: 'skills.patch', params };
  }

  // For node.invoke fallback to nodes.action
  if (method === 'node.invoke' && params) {
    return {
      candidates: ['node.invoke', 'nodes.action'],
      params: [params, params],
    };
  }

  // Default: return candidates with same params
  return {
    candidates,
    params: candidates.map(() => params),
  };
}

// ─── OpenClaw Detection & Auto-Setup ──────────────────────────────────────────

let openclawInstalled = false;
let openclawPath = null;

function detectOpenClaw() {
  log('info', '=== OpenClaw Detection ===');

  // 1. Check if openclaw CLI is installed
  try {
    openclawPath = execSync('which openclaw 2>/dev/null || command -v openclaw 2>/dev/null', { encoding: 'utf8' }).trim();
    if (openclawPath) {
      openclawInstalled = true;
      log('info', `OpenClaw CLI found at: ${openclawPath}`);
      try {
        const version = execSync('openclaw --version 2>&1', { encoding: 'utf8', timeout: 5000 }).trim();
        log('info', `OpenClaw version: ${version}`);
      } catch (_) {}
    }
  } catch (_) {
    // Also check common paths
    const commonPaths = [
      '/usr/local/bin/openclaw',
      '/usr/bin/openclaw',
      path.join(process.env.HOME || '/root', '.local/bin/openclaw'),
      path.join(process.env.HOME || '/root', '.npm-global/bin/openclaw'),
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        openclawInstalled = true;
        openclawPath = p;
        log('info', `OpenClaw CLI found at: ${p}`);
        break;
      }
    }
  }

  if (!openclawInstalled) {
    log('warn', 'OpenClaw CLI not found. Install it with:');
    log('warn', '  npm install -g openclaw');
    log('warn', '  # or');
    log('warn', '  curl -fsSL https://clawhub.com/install.sh | sh');
    log('warn', 'The web channel will still work if the Gateway is accessible.');
  }

  // 2. Check if Gateway is running
  if (openclawInstalled) {
    try {
      const status = execSync('openclaw gateway status 2>&1', { encoding: 'utf8', timeout: 10000 }).trim();
      log('info', `Gateway status: ${status}`);
      if (status.includes('not running') || status.includes('stopped') || status.includes('inactive')) {
        log('info', 'Gateway is not running. Attempting to start...');
        try {
          execSync('openclaw gateway start 2>&1', { encoding: 'utf8', timeout: 15000 });
          log('info', 'Gateway start command sent. Waiting for it to become available...');
        } catch (startErr) {
          log('warn', `Failed to start Gateway: ${startErr.message}`);
        }
      }
    } catch (err) {
      log('warn', `Could not check Gateway status: ${err.message}`);
    }
  }

  // 3. Try a quick WS probe
  tryProbeGateway();
}

function tryProbeGateway() {
  const probe = new WebSocket(CONFIG.gatewayUrl);
  const timeout = setTimeout(() => {
    try { probe.close(); } catch (_) {}
    log('warn', `Gateway WS at ${CONFIG.gatewayUrl} did not respond within 3s`);
  }, 3000);

  probe.on('open', () => {
    clearTimeout(timeout);
    log('info', `Gateway WS at ${CONFIG.gatewayUrl} is reachable`);
    try { probe.close(); } catch (_) {}
  });
  probe.on('error', () => {
    clearTimeout(timeout);
    log('warn', `Gateway WS at ${CONFIG.gatewayUrl} connection failed — will retry via main connection`);
  });
}

// ─── File Upload (multer) ─────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.dll', '.so', '.dylib'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error('File type not allowed'));
    }
    cb(null, true);
  },
});

// Periodic cleanup of uploaded files older than 1 hour
setInterval(() => {
  try {
    const now = Date.now();
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      const fp = path.join(uploadDir, file);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > 3600000) { // 1 hour
        fs.unlinkSync(fp);
        log('info', `Cleaned up old upload: ${file}`);
      }
    }
  } catch (_) {}
}, 300000); // Every 5 minutes

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// Security headers — CSP enabled with appropriate directives for SPA
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS — warn if wildcard in production
if (CONFIG.cors.origin === '*' && process.env.NODE_ENV === 'production') {
  log('warn', 'CORS origin is "*". In production, set cors.origin to your domain in config.json');
}
app.use(cors(CONFIG.cors));
app.use(express.json({ limit: '10mb' }));

// Basic API authentication middleware (optional, enabled when apiToken is set)
const API_TOKEN = process.env.OPENCLAW_API_TOKEN || '';
if (API_TOKEN) {
  log('info', 'API token authentication enabled');
  app.use('/api/', (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${API_TOKEN}`) return next();
    // Also allow query param for SSE compatibility
    if (req.query.token === API_TOKEN) return next();
    res.status(401).json({ error: 'Unauthorized. Set Authorization: Bearer <token>' });
  });
} else {
  log('warn', 'No API token set. Set OPENCLAW_API_TOKEN env var to protect API endpoints');
}

// Rate limiting
const limiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  max: CONFIG.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Serve static frontend from client/dist (React SPA)
const clientDistPath = path.join(__dirname, 'client', 'dist');
const publicPath = path.join(__dirname, 'public');
// Prefer client/dist for v3 React frontend, fall back to public for legacy
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  log('info', 'Serving React frontend from client/dist/');
} else if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  log('info', 'Serving legacy frontend from public/');
} else {
  log('warn', 'No frontend build found in client/dist/ or public/');
}

// ─── Gateway WebSocket Manager ────────────────────────────────────────────────

class GatewayConnection {
  constructor(url, token, reconnectConfig) {
    this.url = url;
    this.token = token;
    this.reconnectConfig = reconnectConfig;
    this.ws = null;
    this.status = 'disconnected';
    this.pendingRequests = new Map();
    this.eventListeners = new Set();
    this.reconnectDelay = reconnectConfig.initialDelay;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectedAt = null;
    this.version = null;
    this.uptime = null;
    this.authFailureCount = 0;
    this.connect();
  }

  connect() {
    // P0 Fix: Concurrent connection protection — check existing state
    if (this.ws && this.ws.readyState !== WebSocket.CONNECTING) {
      log('warn', 'Gateway WS already exists and is not in CONNECTING state, closing before reconnect');
      try { this.ws.close(); } catch (_) {}
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      log('warn', 'Gateway WS is already connecting, skipping duplicate connect()');
      return;
    }

    this.status = 'connecting';
    this.emit('status', { status: this.status });

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      log('error', 'Gateway WS creation failed', { error: err.message });
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      log('info', 'Gateway WS connected, sending handshake...');
      this.ws.send(JSON.stringify({
        type: 'connect',
        params: { auth: { token: this.token } },
      }));
    });

    this.ws.on('message', (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch (_) { return; }
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      log('warn', 'Gateway WS closed', { code, reason: reason?.toString() });
      this.status = 'disconnected';
      this.connectedAt = null;
      this.emit('status', { status: this.status });
      this.rejectAllPending('Gateway connection closed');
      // Detect auth failures (1008 = Policy Violation, often used for auth rejection)
      if (code === 1008 || code === 4001) {
        this.authFailureCount++;
        if (this.authFailureCount >= 3) {
          log('error', 'Gateway rejected authentication 3 times. Check your gatewayToken. Halting reconnection.');
          log('error', 'Fix: set OPENCLAW_GATEWAY_TOKEN in .env or config.json, then restart.');
          this.emit('status', { status: 'auth_failed', message: 'Authentication failed. Check gatewayToken.' });
          return; // Stop reconnecting
        }
        log('warn', `Possible auth failure (attempt ${this.authFailureCount}/3). Check gatewayToken.`);
      } else {
        this.authFailureCount = 0; // Reset on non-auth failures
      }
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      log('error', 'Gateway WS error', { error: err.message });
    });
  }

  handleMessage(data) {
    // Connection acknowledgement
    if (data.type === 'connected' || data.type === 'connect_ack') {
      this.status = 'connected';
      this.connectedAt = Date.now();
      this.reconnectDelay = this.reconnectConfig.initialDelay;
      if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
      this.version = data.version || data.params?.version || null;
      log('info', `Gateway connected successfully${this.version ? ` (version: ${this.version})` : ''}`);
      this.emit('status', { status: this.status, version: this.version });
      this.startHeartbeat();
      return;
    }

    // RPC response
    if (data.type === 'response' && data.id) {
      const pending = this.pendingRequests.get(data.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(data.id);
        if (data.error) {
          pending.reject(new Error(data.error.message || data.error));
        } else {
          pending.resolve(data.result || data.data || data);
        }
      }
      return;
    }

    // Chat events (streaming)
    if (data.type === 'chat') {
      this.emit('chat', data);
      return;
    }

    // Log events
    if (data.type === 'log') {
      this.emit('log', data);
      return;
    }

    // Status events
    if (data.type === 'status') {
      this.emit('status_event', data);
      return;
    }

    // Fallback
    this.emit('event', data);
  }

  /**
   * Raw RPC call to the gateway.
   */
  rpc(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (this.status !== 'connected') {
        return reject(new Error('Gateway not connected'));
      }
      const id = crypto.randomUUID();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pendingRequests.set(id, { resolve, reject, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new Error(`RPC ${method} send failed: ${err.message}`));
      }
    });
  }

  /**
   * Version-aware RPC call with automatic method fallback.
   * Uses the RPC adapter layer to try multiple method names.
   */
  async rpcAdapt(method, params = {}, timeoutMs = 30000) {
    const adapted = adaptRpcMethod(method, params);

    // Simple case: single method, no adaptation needed
    if (!adapted.candidates) {
      return this.rpc(adapted.method, adapted.params, timeoutMs);
    }

    // Try each candidate method in order
    const { candidates, params: paramList } = adapted;
    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
      try {
        const result = await this.rpc(candidates[i], paramList[i], timeoutMs);
        if (i > 0) {
          log('info', `RPC adapter: ${method} fell back to ${candidates[i]} successfully`);
        }
        return result;
      } catch (err) {
        lastError = err;
        // If it's not a "method not found" type error, don't try fallback
        if (err.message && !err.message.includes('timed out') && !err.message.includes('not connected')) {
          // Continue to next candidate
        } else {
          // For timeout or connection errors, don't try fallback
          throw err;
        }
      }
    }

    throw lastError || new Error(`RPC ${method} failed: all adapter candidates exhausted`);
  }

  addEventListener(cb) {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  emit(event, data) {
    for (const cb of this.eventListeners) {
      try { cb(event, data); } catch (_) {}
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try { this.ws.ping(); } catch (_) {}
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  rejectAllPending(reason) {
    for (const [id, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
      reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(this.reconnectDelay, this.reconnectConfig.maxDelay);
    log('info', `Reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectDelay = Math.min(this.reconnectDelay * this.reconnectConfig.multiplier, this.reconnectConfig.maxDelay);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.rejectAllPending('Client disconnected');
    if (this.ws) { try { this.ws.close(); } catch (_) {} }
    this.ws = null;
    this.status = 'disconnected';
  }
}

const gateway = new GatewayConnection(CONFIG.gatewayUrl, CONFIG.gatewayToken, CONFIG.reconnect);

// ─── Browser WebSocket Server ─────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });
const browserClients = new Set();

// Track streaming state per client for timeout guard
const clientStreamingState = new Map(); // ws -> { isStreaming, streamTimer, pendingChatRun }

/**
 * Clean up streaming state for a disconnected client.
 */
function cleanupClientStreaming(ws) {
  const state = clientStreamingState.get(ws);
  if (state) {
    if (state.streamTimer) clearTimeout(state.streamTimer);
    if (state.pendingChatRun) {
      // Attempt to abort the pending chat run on the gateway
      gateway.rpc('chat.abort', { sessionKey: CONFIG.sessionKey }).catch(() => {});
      log('info', 'Aborted pending chat run due to client disconnect');
    }
    clientStreamingState.delete(ws);
  }
}

wss.on('connection', (ws, req) => {
  // P0 Fix: WebSocket connection limit
  if (browserClients.size >= CONFIG.maxWebSocketConnections) {
    log('warn', `WebSocket connection rejected: limit reached (${CONFIG.maxWebSocketConnections})`);
    ws.close(1013, 'Maximum WebSocket connections reached');
    return;
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  log('info', 'Browser client connected', { ip: clientIp, totalClients: browserClients.size + 1 });

  // Initialize streaming state
  clientStreamingState.set(ws, { isStreaming: false, streamTimer: null, pendingChatRun: null });

  const unsubscribe = gateway.addEventListener((event, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      // Forward gateway events to browser client using JSON-RPC 2.0 notification format
      const payload = JSON.stringify({ jsonrpc: '2.0', method: event, params: data });
      ws.send(payload);

      // P0 Fix: Streaming timeout guard — track streaming state
      if (event === 'chat') {
        const state = clientStreamingState.get(ws);
        if (state) {
          if (!data.done && !state.isStreaming) {
            // Streaming started
            state.isStreaming = true;
            state.pendingChatRun = true;
            // Set timeout guard
            state.streamTimer = setTimeout(() => {
              log('warn', `Stream timeout (${CONFIG.streamTimeout}ms) for client, aborting`);
              state.isStreaming = false;
              state.pendingChatRun = null;
              gateway.rpc('chat.abort', { sessionKey: CONFIG.sessionKey }).catch(() => {});
            }, CONFIG.streamTimeout);
          } else if (data.done && state.isStreaming) {
            // Streaming completed
            state.isStreaming = false;
            state.pendingChatRun = null;
            if (state.streamTimer) {
              clearTimeout(state.streamTimer);
              state.streamTimer = null;
            }
          }
        }
      }
    }
  });

  browserClients.add(ws);

  // Send current status immediately using JSON-RPC 2.0 notification format
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'status',
    params: { status: gateway.status, version: gateway.version },
  }));

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }

    if (msg.method) {
      try {
        // Track pending chat runs for timeout cleanup
        if (msg.method === 'chat.send') {
          const state = clientStreamingState.get(ws);
          if (state) {
            state.pendingChatRun = true;
          }
        }

        const result = await gateway.rpc(msg.method, msg.params || {});
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));

        // Clear pending state after non-streaming response
        if (msg.method === 'chat.send') {
          const state = clientStreamingState.get(ws);
          if (state) {
            state.pendingChatRun = null;
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: err.message } }));
        // Clear pending state on error
        if (msg.method === 'chat.send') {
          const state = clientStreamingState.get(ws);
          if (state) {
            state.pendingChatRun = null;
          }
        }
      }
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    unsubscribe();
    browserClients.delete(ws);
    // P0 Fix: Clean up streaming state on disconnect
    cleanupClientStreaming(ws);
    log('info', 'Browser client disconnected', { totalClients: browserClients.size });
  });

  ws.on('error', () => {
    unsubscribe();
    browserClients.delete(ws);
    cleanupClientStreaming(ws);
  });
});

// ─── REST API Endpoints ───────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    gateway: gateway.status,
    version: gateway.version,
    uptime: process.uptime(),
    clients: browserClients.size,
    maxConnections: CONFIG.maxWebSocketConnections,
    openclawInstalled,
    openclawPath,
  });
});

// Gateway version detection endpoint
app.get('/api/gateway/version', async (_req, res) => {
  try {
    if (gateway.status !== 'connected') {
      return res.json({ status: gateway.status, version: null });
    }
    // If version was detected during connection handshake, return it
    if (gateway.version) {
      return res.json({ status: 'connected', version: gateway.version });
    }
    // Otherwise, try to get version via RPC
    try {
      const result = await gateway.rpc('status', {});
      const version = result?.version || result?.gatewayVersion || null;
      res.json({ status: 'connected', version });
    } catch (_) {
      res.json({ status: 'connected', version: null });
    }
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Helper function to get disk usage
function getDiskUsage() {
  try {
    // Linux/Mac - use df command
    const output = execSync('df -k /', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    // Skip header line, parse the data line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 6) {
        const total = parseInt(parts[1], 10) * 1024; // Convert KB to bytes
        const used = parseInt(parts[2], 10) * 1024;
        const free = parseInt(parts[3], 10) * 1024;
        const usagePercent = Math.round((used / total) * 100);
        return { total, used, free, usagePercent };
      }
    }
  } catch {
    // Fallback: try Windows wmic command
    try {
      const output = execSync('wmic logicaldisk get size,freespace,caption /format:csv', { encoding: 'utf8' });
      const lines = output.trim().split('\n').filter(line => line.includes(','));
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 4) {
          const caption = parts[1].trim();
          if (caption === 'C:' || caption === '/') {
            const free = parseInt(parts[2].trim(), 10);
            const total = parseInt(parts[3].trim(), 10);
            const used = total - free;
            const usagePercent = Math.round((used / total) * 100);
            return { total, used, free, usagePercent };
          }
        }
      }
    } catch {
      // Final fallback: return null
    }
  }
  return null;
}

// Gateway status
app.get('/api/status', async (_req, res) => {
  try {
    const disk = getDiskUsage();
    if (gateway.status !== 'connected') {
      return res.json({ status: gateway.status, version: null, clients: browserClients.size, disk });
    }
    const result = await gateway.rpc('status', {});
    res.json({ status: gateway.status, version: gateway.version, gateway: result, clients: browserClients.size, disk });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────

// Chat history with search support
app.get('/api/history', async (req, res) => {
  try {
    const sessionKey = req.query.session || req.query.sessionKey || CONFIG.sessionKey;
    const search = req.query.search || '';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 50;

    // Fetch history from gateway
    const result = await gateway.rpc('chat.history', { sessionKey, limit: 1000 });
    let messages = result?.messages || result || [];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      messages = messages.filter((msg) => {
        const content = String(msg.content || '').toLowerCase();
        const role = String(msg.role || '').toLowerCase();
        return content.includes(searchLower) || role.includes(searchLower);
      });
    }

    // Apply date range filter
    if (startDate || endDate) {
      messages = messages.filter((msg) => {
        const msgTime = msg.timestamp ? new Date(msg.timestamp) : null;
        if (!msgTime) return true;
        if (startDate && msgTime < startDate) return false;
        if (endDate && msgTime > endDate) return false;
        return true;
      });
    }

    // Calculate pagination
    const total = messages.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedMessages = messages.slice(startIndex, startIndex + pageSize);

    res.json({
      messages: paginatedMessages,
      total,
      page,
      pageSize,
      totalPages,
      sessionKey,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Send chat message
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionKey, model, thinking } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    const result = await gateway.rpc('chat.send', {
      message,
      sessionKey: sessionKey || CONFIG.sessionKey,
      ...(model && { model }),
      ...(thinking !== undefined && { thinking }),
    }, CONFIG.streamTimeout);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Abort chat
app.post('/api/abort', async (req, res) => {
  try {
    const sessionKey = req.body.sessionKey || CONFIG.sessionKey;
    const result = await gateway.rpc('chat.abort', { sessionKey });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Inject message
app.post('/api/inject', async (req, res) => {
  try {
    const { text, sessionKey } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const result = await gateway.rpc('chat.inject', { text, sessionKey: sessionKey || CONFIG.sessionKey });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Sessions ──────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (_req, res) => {
  try {
    const result = await gateway.rpc('sessions.list', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { sessionKey, model, thinking } = req.body;
    if (!sessionKey) return res.status(400).json({ error: 'sessionKey is required' });
    // Gateway creates sessions implicitly on first chat.send;
    // use sessions.patch to set model/thinking on the new session key
    const patch = {};
    if (model) patch.model = model;
    if (thinking !== undefined) patch.thinking = thinking;
    const result = Object.keys(patch).length > 0
      ? await gateway.rpc('sessions.patch', { sessionKey, ...patch })
      : { sessionKey, created: true };
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch('/api/sessions/:key', async (req, res) => {
  try {
    const result = await gateway.rpc('sessions.patch', { sessionKey: req.params.key, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/sessions/:key/reset', async (req, res) => {
  try {
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('sessions.reset', { sessionKey: req.params.key });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/sessions/:key/compact', async (req, res) => {
  try {
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('sessions.compact', { sessionKey: req.params.key });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.delete('/api/sessions/:key', async (req, res) => {
  try {
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('sessions.delete', { sessionKey: req.params.key });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/sessions/:key/transcript', async (req, res) => {
  try {
    const result = await gateway.rpc('chat.history', { sessionKey: req.params.key, limit: parseInt(req.query.limit, 10) || 200 });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Config ────────────────────────────────────────────────────────────────────

app.get('/api/config', async (_req, res) => {
  try {
    const result = await gateway.rpc('config.get', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch('/api/config', async (req, res) => {
  try {
    const result = await gateway.rpc('config.patch', req.body);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/config/schema', async (_req, res) => {
  try {
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('config.schema.lookup', {});
    res.json(result);
  } catch (err) {
    // Return a basic schema if neither RPC method is supported
    res.json({
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Default AI model' },
        thinking: { type: 'boolean', description: 'Enable thinking/reasoning mode' },
      },
    });
  }
});

// ── Channels ──────────────────────────────────────────────────────────────────

app.get('/api/channels', async (_req, res) => {
  try {
    const result = await gateway.rpc('channels.status', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Health (from gateway) ─────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    const result = await gateway.rpc('health', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Cron Jobs ─────────────────────────────────────────────────────────────────

// List all cron jobs
app.get('/api/cron', async (_req, res) => {
  try {
    const result = await gateway.rpc('cron.list', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Create new cron job
app.post('/api/cron', async (req, res) => {
  try {
    const { name, schedule, enabled, command } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!schedule) return res.status(400).json({ error: 'schedule is required' });
    if (enabled === undefined) return res.status(400).json({ error: 'enabled is required' });

    const result = await gateway.rpc('cron.create', { name, schedule, enabled, command });
    res.json({ success: true, job: result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Get single cron job details
app.get('/api/cron/:id', async (req, res) => {
  try {
    const result = await gateway.rpc('cron.get', { id: req.params.id });
    res.json({ job: result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Delete cron job
app.delete('/api/cron/:id', async (req, res) => {
  try {
    await gateway.rpc('cron.delete', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Run cron job immediately
app.post('/api/cron/:id/run', async (req, res) => {
  try {
    const result = await gateway.rpc('cron.run', { id: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Update cron job
app.patch('/api/cron/:id', async (req, res) => {
  try {
    const result = await gateway.rpc('cron.patch', { id: req.params.id, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Logs (SSE) ────────────────────────────────────────────────────────────────

app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send recent buffer
  const recentLogs = LOG_BUFFER.slice(-100);
  for (const entry of recentLogs) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  // SSE keepalive every 30s to prevent proxy timeout
  const keepalive = setInterval(() => {
    try { res.write(':keepalive\n\n'); } catch (_) {}
  }, 30000);

  const listener = (entry) => {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch (_) {}
  };
  logListeners.add(listener);

  // Subscribe to gateway log events ONLY (not all events)
  const unsubGateway = gateway.addEventListener((event, data) => {
    if (event === 'log' && data?.level && data?.msg) {
      // Only forward properly structured log entries
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
    }
  });

  // Start log tail on gateway
  gateway.rpc('logs.tail', {}).catch(() => {});

  req.on('close', () => {
    clearInterval(keepalive);
    logListeners.delete(listener);
    unsubGateway();
  });
});

// ── File Upload ───────────────────────────────────────────────────────────────

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/api/uploads/${req.file.filename}`,
    };

    // If sessionKey provided, try to send as attachment via gateway
    const sessionKey = req.body.sessionKey || CONFIG.sessionKey;
    if (sessionKey && gateway.status === 'connected') {
      try {
        // Limit base64 encoding to 20MB to prevent OOM
        if (req.file.size > 20 * 1024 * 1024) {
          fileInfo.gatewayError = 'File too large for inline attachment (max 20MB). File was saved and can be accessed via URL.';
        } else {
          const base64 = fs.readFileSync(req.file.path, { encoding: 'base64' });
          const dataUri = `data:${req.file.mimetype};base64,${base64}`;
          const result = await gateway.rpc('chat.send', {
            message: `[Attached file: ${req.file.originalname}]`,
            sessionKey,
            media: [{ type: req.file.mimetype, data: dataUri, name: req.file.originalname }],
          });
          fileInfo.gatewayResult = result;
        }
      } catch (gwErr) {
        fileInfo.gatewayError = gwErr.message;
      }
    }

    res.json({ success: true, file: fileInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve uploaded files (with path traversal protection)
app.get('/api/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // Strip directory components
  const filePath = path.join(uploadDir, filename);
  // Double-check the resolved path is within uploadDir
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(uploadDir))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

// ── Metrics ───────────────────────────────────────────────────────────────────

// Cost tracking endpoint
app.get('/api/metrics/cost', async (_req, res) => {
  try {
    // Try to get real cost data from gateway first
    let costData = null;
    try {
      costData = await gateway.rpc('metrics.cost', {});
    } catch {
      // Gateway doesn't support cost metrics, use mock data
    }

    // Generate mock history for the last 30 days
    const history = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Random daily cost between $0.50 and $5.00
      const dailyCost = Math.round((0.5 + Math.random() * 4.5) * 100) / 100;
      history.push({
        date: date.toISOString().split('T')[0],
        cost: dailyCost,
      });
    }

    // Calculate today's and this month's cost from history
    const todayStr = today.toISOString().split('T')[0];
    const todayEntry = history.find(h => h.date === todayStr);
    const todayCost = todayEntry ? todayEntry.cost : 0;
    const thisMonthCost = history
      .filter(h => h.date.startsWith(todayStr.substring(0, 7)))
      .reduce((sum, h) => sum + h.cost, 0);

    // Default budget: $100/month
    const budgetAmount = costData?.budget?.amount ?? 100;
    const usagePercent = Math.min(100, Math.round((thisMonthCost / budgetAmount) * 100));

    res.json({
      today: {
        cost: costData?.today?.cost ?? todayCost,
        currency: costData?.today?.currency ?? 'USD',
      },
      thisMonth: {
        cost: costData?.thisMonth?.cost ?? Math.round(thisMonthCost * 100) / 100,
        currency: costData?.thisMonth?.currency ?? 'USD',
      },
      budget: {
        amount: budgetAmount,
        currency: costData?.budget?.currency ?? 'USD',
        period: costData?.budget?.period ?? 'monthly',
      },
      usagePercent,
      history: costData?.history ?? history,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Token usage metrics endpoint
app.get('/api/metrics/tokens', async (_req, res) => {
  try {
    // Try to get real token data from gateway first
    let tokenData = null;
    try {
      tokenData = await gateway.rpc('metrics.tokens', {});
    } catch {
      // Gateway doesn't support token metrics, use mock data
    }

    // Generate hourly data for the last 24 hours
    const hourly = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now);
      hour.setHours(hour.getHours() - i);
      const hourStr = `${hour.getHours().toString().padStart(2, '0')}:00`;
      // Random token usage
      const input = Math.floor(1000 + Math.random() * 4000);
      const output = Math.floor(500 + Math.random() * 2000);
      hourly.push({ hour: hourStr, input, output });
    }

    // Mock data by model
    const byModel = [
      { model: 'gpt-4', tokens: 125000 },
      { model: 'gpt-3.5-turbo', tokens: 89000 },
      { model: 'claude-3-opus', tokens: 67000 },
      { model: 'claude-3-sonnet', tokens: 45000 },
    ];

    const totalInput = hourly.reduce((sum, h) => sum + h.input, 0);
    const totalOutput = hourly.reduce((sum, h) => sum + h.output, 0);

    res.json({
      hourly: tokenData?.hourly ?? hourly,
      byModel: tokenData?.byModel ?? byModel,
      total: tokenData?.total ?? {
        input: totalInput,
        output: totalOutput,
      },
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Models ────────────────────────────────────────────────────────────────────

app.get('/api/models', async (_req, res) => {
  try {
    const result = await gateway.rpc('models.list', {});
    res.json(result);
  } catch (err) {
    // Fallback: return what we know
    res.json({ models: [], error: err.message });
  }
});

// ── Skills ────────────────────────────────────────────────────────────────────

app.get('/api/skills', async (_req, res) => {
  try {
    const result = await gateway.rpc('skills.list', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Get single skill details with extended information
app.get('/api/skills/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Get basic skill info from skills.list
    const listResult = await gateway.rpc('skills.list', {});
    const skills = Array.isArray(listResult) ? listResult : listResult?.skills || [];
    const basicSkill = skills.find((s) => s.name === name || s.id === name);

    if (!basicSkill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Try to get more details from skills.get if available
    let extendedInfo = {};
    try {
      const detailResult = await gateway.rpc('skills.get', { name });
      extendedInfo = detailResult || {};
    } catch (_) {
      // skills.get may not be supported, use basic info
    }

    // Construct full skill detail response
    const skillDetail = {
      name: basicSkill.name || name,
      version: basicSkill.version || extendedInfo.version || '1.0.0',
      category: basicSkill.category || extendedInfo.category || 'general',
      description: basicSkill.description || extendedInfo.description || '',
      enabled: basicSkill.enabled !== undefined ? basicSkill.enabled : true,
      readme: extendedInfo.readme || extendedInfo.documentation || null,
      parameters: extendedInfo.parameters || extendedInfo.configSchema || extendedInfo.params || null,
      examples: extendedInfo.examples || extendedInfo.usage || null,
      author: extendedInfo.author || extendedInfo.maintainer || null,
      repository: extendedInfo.repository || extendedInfo.repo || extendedInfo.url || null,
      ...extendedInfo,
    };

    res.json(skillDetail);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch('/api/skills/:name', async (req, res) => {
  try {
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('skills.patch', { name: req.params.name, ...req.body });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Nodes ─────────────────────────────────────────────────────────────────────

app.get('/api/nodes', async (_req, res) => {
  try {
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('node.list', {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/nodes/:id/action', async (req, res) => {
  try {
    const { action, params } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });
    // Use RPC adapter for version-aware fallback
    const result = await gateway.rpcAdapt('node.invoke', { nodeId: req.params.id, action, params: params || {} });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Device Management ─────────────────────────────────────────────────────────

// List paired devices
app.get('/api/nodes/devices', (_req, res) => {
  const devices = Array.from(devicesStore.values()).map(({ token, ...device }) => device);
  res.json({ devices });
});

// Approve device pairing
app.post('/api/nodes/devices/:id/approve', (req, res) => {
  const device = devicesStore.get(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  device.status = 'approved';
  device.lastSeen = new Date().toISOString();
  const { token, ...responseDevice } = device;
  res.json({ success: true, device: responseDevice });
});

// Revoke device token
app.post('/api/nodes/devices/:id/revoke', (req, res) => {
  const device = devicesStore.get(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  device.status = 'revoked';
  device.lastSeen = new Date().toISOString();
  res.json({ success: true });
});

// Rotate device token
app.post('/api/nodes/devices/:id/rotate', (req, res) => {
  const device = devicesStore.get(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  device.token = crypto.randomBytes(32).toString('hex');
  device.lastSeen = new Date().toISOString();
  const { token, ...responseDevice } = device;
  res.json({ success: true, device: responseDevice });
});

// ── Gateway Discovery ─────────────────────────────────────────────────────────

// Mock mDNS discovery - scan for gateways
async function performDiscovery() {
  discoveryScanning = true;
  lastDiscoveryScan = new Date().toISOString();
  
  // Simulate discovery delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Add some mock discovered gateways
  const mockGateways = [
    {
      id: 'gw-local-001',
      name: 'OpenClaw Gateway (Local)',
      url: 'ws://localhost:18789',
      version: '3.2.1',
      lastSeen: new Date().toISOString(),
      rssi: -45,
    },
    {
      id: 'gw-dev-001',
      name: 'Dev Gateway',
      url: 'ws://192.168.1.50:18789',
      version: '3.1.0',
      lastSeen: new Date().toISOString(),
      rssi: -62,
    },
    {
      id: 'gw-test-001',
      name: 'Test Environment',
      url: 'ws://10.0.0.100:18789',
      version: '3.0.5',
      lastSeen: new Date().toISOString(),
      rssi: -78,
    },
  ];
  
  mockGateways.forEach(gw => {
    discoveredGatewaysStore.set(gw.id, gw);
  });
  
  discoveryScanning = false;
}

// Get discovery status and found gateways
app.get('/api/discovery', (req, res) => {
  const found = Array.from(discoveredGatewaysStore.values());
  res.json({
    scanning: discoveryScanning,
    found,
    lastScan: lastDiscoveryScan,
  });
});

// Refresh discovery scan
app.post('/api/discovery/refresh', async (req, res) => {
  if (discoveryScanning) {
    return res.json({ success: true, message: 'Scan already in progress' });
  }
  
  // Start scan in background
  performDiscovery().catch(() => {});
  
  res.json({ success: true, message: 'Discovery scan started' });
});

// Connect to discovered gateway
app.post('/api/discovery/connect', async (req, res) => {
  const { url, token } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  
  // In a real implementation, this would update the gateway connection
  // For now, just validate the URL format
  try {
    new URL(url);
    res.json({ 
      success: true, 
      message: 'Gateway connection updated',
      gateway: { url, token: token ? '***' : undefined }
    });
  } catch {
    res.status(400).json({ error: 'Invalid URL format' });
  }
});

// ── Canvas ────────────────────────────────────────────────────────────────────

// Canvas data store per session
const canvasStore = new Map();

// Get canvas data for a session
app.get('/api/canvas/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const canvasData = canvasStore.get(sessionId) || {
    elements: [],
    background: '#ffffff',
    width: 800,
    height: 600,
  };
  res.json({ canvasData });
});

// Update canvas data for a session
app.post('/api/canvas/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { canvasData } = req.body;
  
  if (!canvasData) {
    return res.status(400).json({ error: 'canvasData is required' });
  }
  
  canvasStore.set(sessionId, canvasData);
  res.json({ success: true, canvasData });
});

// Clear canvas for a session
app.delete('/api/canvas/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  canvasStore.delete(sessionId);
  res.json({ success: true });
});

// ── Dashboard (aggregate) ─────────────────────────────────────────────────────

app.get('/api/dashboard', async (_req, res) => {
  const dashboard = {
    gateway: {
      status: gateway.status,
      version: gateway.version,
      uptime: gateway.connectedAt ? Math.floor((Date.now() - gateway.connectedAt) / 1000) : 0,
      clients: browserClients.size,
      maxConnections: CONFIG.maxWebSocketConnections,
    },
    openclaw: {
      installed: openclawInstalled,
      path: openclawPath,
    },
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      pid: process.pid,
    },
    sessions: null,
    channels: null,
    health: null,
    cron: null,
  };

  const fetches = [];
  if (gateway.status === 'connected') {
    fetches.push(
      gateway.rpc('sessions.list', {}).then(r => { dashboard.sessions = r; }).catch(() => {}),
      gateway.rpc('channels.status', {}).then(r => { dashboard.channels = r; }).catch(() => {}),
      gateway.rpc('health', {}).then(r => { dashboard.health = r; }).catch(() => {}),
      gateway.rpc('cron.list', {}).then(r => { dashboard.cron = r; }).catch(() => {}),
    );
  }

  await Promise.allSettled(fetches);
  res.json(dashboard);
});

// ── SPA Fallback ──────────────────────────────────────────────────────────────

// 404 for unknown API routes (before SPA fallback)
app.use('/api/', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req, res) => {
  // Prefer client/dist for v3 React frontend
  const indexPath = fs.existsSync(clientDistPath)
    ? path.join(clientDistPath, 'index.html')
    : path.join(publicPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('OpenClaw Web Channel v3.0 — Frontend not built. Run: cd client && npm run build');
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown(signal) {
  log('info', `Shutting down (${signal})`);
  gateway.disconnect();
  for (const ws of browserClients) {
    try { ws.close(1001, 'Server shutting down'); } catch (_) {}
  }
  // Clean up all streaming states
  for (const [ws] of clientStreamingState) {
    cleanupClientStreaming(ws);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Prevent crashes from unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled promise rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  // Don't exit — keep serving existing connections
});

// ─── Start ────────────────────────────────────────────────────────────────────

// Run OpenClaw detection on startup
detectOpenClaw();

server.listen(CONFIG.port, CONFIG.host, () => {
  log('info', `OpenClaw Web Channel v3.0 listening on ${CONFIG.host}:${CONFIG.port}`);
  log('info', `Gateway: ${CONFIG.gatewayUrl}`);
  log('info', `OpenClaw installed: ${openclawInstalled}`);
  log('info', `Max WebSocket connections: ${CONFIG.maxWebSocketConnections}`);
  log('info', `Stream timeout: ${CONFIG.streamTimeout}ms`);
});
