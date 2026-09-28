import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './roomManager.js';
import { registerSocketHandlers } from './socketHandlers.js';
import { getLanIp } from './utils/lanIp.js';
import { connectDatabase, getDbStatus } from './db.js';
import { authRouter } from './routes/authRoutes.js';
import { callRouter } from './routes/callRoutes.js';
import { recordingRouter } from './routes/recordingRoutes.js';

dotenv.config();

const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const lanIp = getLanIp();

const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

// Standard allowed origins for development (supporting both http and https)
const defaultAllowedOrigins = new Set([
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  ...(lanIp ? [
    `http://${lanIp}:5173`,
    `https://${lanIp}:5173`,
    `http://${lanIp}:3000`,
    `https://${lanIp}:3000`,
  ] : []),
  ...configuredOrigins,
]);

// Pattern to allow private LAN development origins on port 5173 (supporting both http and https)
const privateNetworkVitePattern = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$/;

export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, or test runners)
  if (!origin) return true;

  // In development, permit all origins so LAN devices connect smoothly
  if (process.env.NODE_ENV !== 'production') return true;

  if (defaultAllowedOrigins.has(origin)) return true;

  if (privateNetworkVitePattern.test(origin)) return true;

  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));

// Configure raw body parser for video recording uploads up to 500MB
app.use('/api/recordings/upload', express.raw({
  type: ['video/*', 'application/octet-stream', 'application/x-binary', '*/*'],
  limit: '500mb',
}));

app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

const roomManager = new RoomManager();

// Register socket signaling handlers
registerSocketHandlers(io, roomManager);

// Mount Authentication, Call History & Recording REST API routes
app.use('/api/auth', authRouter);
app.use('/api/calls', callRouter);
app.use('/api/recordings', recordingRouter);

// API Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDbStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'WebRTC Signaling Server',
    database: {
      connected: dbStatus.isConnected,
      uri: dbStatus.uri,
      error: dbStatus.error,
    },
    lanIp: lanIp || 'unknown',
  });
});

const clientDistCandidates = [
  path.resolve(process.cwd(), '..', 'client', 'dist'),
  path.resolve(process.cwd(), 'client', 'dist'),
  path.resolve(process.cwd(), 'dist', 'client'),
];
const resolvedDist = clientDistCandidates.find((p) => fs.existsSync(p));

if (resolvedDist && (process.env.SERVE_CLIENT === 'true' || process.env.NODE_ENV === 'production')) {
  app.use(express.static(resolvedDist));
  app.get(/^(?!\/(api|socket\.io)).*/, (_req, res) => {
    res.sendFile(path.join(resolvedDist, 'index.html'));
  });
} else {
  // Root portal endpoint: provides automatic HTTP-to-HTTPS redirect and 1-tap launcher for LAN devices
  app.get('/', (req, res) => {
  const targetHost = lanIp || req.hostname || 'localhost';
  const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const httpsUrl = `https://${targetHost}:5173/${queryStr}`;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StreamCall LAN Portal</title>
  <style>
    body {
      background: #0b0f19;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
      box-sizing: border-box;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 1.6rem;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    a.btn {
      display: block;
      background: #10b981;
      color: #ffffff;
      font-weight: 700;
      font-size: 1.05rem;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 10px;
      transition: background 0.2s;
    }
    a.btn:hover {
      background: #059669;
    }
    .hint {
      margin-top: 20px;
      font-size: 0.82rem;
      color: #64748b;
    }
  </style>
  <script>
    // Automatically redirect after 1.5s
    setTimeout(function() {
      window.location.href = "${httpsUrl}";
    }, 1200);
  </script>
</head>
<body>
  <div class="card">
    <h1>StreamCall LAN Portal</h1>
    <p>Connecting to secure calling session...</p>
    <a class="btn" href="${httpsUrl}">Open StreamCall (HTTPS) &rarr;</a>
    <p class="hint">Note: When prompted with "Connection not private", tap <strong>Advanced &rarr; Proceed</strong> to enable camera and microphone permissions.</p>
  </div>
</body>
</html>`);
  });
}

// API endpoint to inspect room status (non-sensitive)
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = roomManager.getRoom(roomId);
  if (!room) {
    return res.json({ exists: false, count: 0 });
  }
  return res.json({
    exists: true,
    roomId: room.id,
    participantCount: room.participants.size,
    isFull: room.participants.size >= 10,
    maxParticipants: 10,
  });
});

// Initiate MongoDB database connection
connectDatabase().catch((err) => {
  console.warn('[MongoDB] Initial connection error handled:', err.message);
});

server.listen(PORT, HOST, () => {
  console.log(`=========================================`);
  console.log(`StreamCall Development Server`);
  console.log(``);
  console.log(`Frontend (HTTPS - Recommended for real camera/mic on LAN):`);
  console.log(`  Local: https://localhost:5173`);
  if (lanIp) {
    console.log(`  LAN:   https://${lanIp}:5173`);
  }
  console.log(``);
  console.log(`Frontend (HTTP):`);
  console.log(`  Local: http://localhost:5173`);
  if (lanIp) {
    console.log(`  LAN:   http://${lanIp}:5173`);
  }
  console.log(``);
  console.log(`Backend Signaling Server:`);
  console.log(`  Local: http://localhost:${PORT}`);
  if (lanIp) {
    console.log(`  LAN:   http://${lanIp}:${PORT}`);
  }
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});

