import os from 'os';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { io } from 'socket.io-client';

function getLanIp() {
  const interfaces = os.networkInterfaces();
  const priorityInterfaces = ['Wi-Fi', 'Ethernet', 'en0', 'wlan0', 'eth0'];

  for (const name of priorityInterfaces) {
    const addresses = interfaces[name];
    if (addresses) {
      for (const addr of addresses) {
        if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal && addr.address !== '127.0.0.1') {
          return addr.address;
        }
      }
    }
  }

  for (const name of Object.keys(interfaces)) {
    const addresses = interfaces[name];
    if (!addresses) continue;
    for (const addr of addresses) {
      if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal && addr.address !== '127.0.0.1') {
        return addr.address;
      }
    }
  }

  return null;
}

function checkHttp(url, headers = {}) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    const req = client.get(url, { headers, timeout: 5000, rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
  });
}

let serverProc = null;
let clientProc = null;

async function ensureServersRunning(lanIp) {
  const isServerUp = (await checkHttp('http://localhost:5000/api/health')).ok;
  const isClientUp = (await checkHttp('http://localhost:5173')).ok || (await checkHttp('https://localhost:5173')).ok;

  if (!isServerUp) {
    console.log('[LAN Test Setup] Starting backend signaling server on 0.0.0.0:5000...');
    serverProc = spawn('npm', ['run', 'dev:server'], { shell: true, stdio: 'ignore' });
    let attempts = 0;
    while (!(await checkHttp('http://localhost:5000/api/health')).ok && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
    }
  }

  if (!isClientUp) {
    console.log('[LAN Test Setup] Starting frontend client on 0.0.0.0:5173...');
    clientProc = spawn('npm', ['run', 'dev:client'], { shell: true, stdio: 'ignore' });
    let attempts = 0;
    while (!(await checkHttp('http://localhost:5173')).ok && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
    }
  }

  console.log('[LAN Test Setup] Servers ready.\n');
}

function cleanup() {
  const procs = [serverProc, clientProc].filter(Boolean);
  for (const proc of procs) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t']);
      } else {
        proc.kill();
      }
    } catch (_) {}
  }
}

async function runLanTest() {
  console.log('====================================================');
  console.log('🌐 RUNNING STREAMCALL LAN NETWORK VERIFICATION');
  console.log('====================================================');

  const lanIp = getLanIp();
  if (!lanIp) {
    console.error('❌ Could not detect an active LAN IPv4 interface.');
    process.exit(1);
  }

  console.log(`📡 Detected LAN IP: ${lanIp}`);
  console.log(`🌐 Frontend URL:    http://${lanIp}:5173`);
  console.log(`⚙️  Backend URL:     http://${lanIp}:5000\n`);

  await ensureServersRunning(lanIp);

  const results = {};

  // 1. Test Backend API over LAN IP
  console.log(`[Test 1] Testing Backend Health endpoint via LAN IP (http://${lanIp}:5000/api/health)...`);
  const backendHealth = await checkHttp(`http://${lanIp}:5000/api/health`);
  if (backendHealth.ok) {
    console.log(`✔ Backend reachable over LAN IP (HTTP ${backendHealth.statusCode})`);
    results['Backend LAN Binding'] = 'PASS';
  } else {
    console.error(`✖ Backend not reachable over LAN IP:`, backendHealth.error || backendHealth.statusCode);
    results['Backend LAN Binding'] = 'FAIL';
  }

  // 2. Test CORS from LAN Frontend Origin
  console.log(`\n[Test 2] Testing CORS validation with Origin http://${lanIp}:5173...`);
  const corsTest = await checkHttp(`http://${lanIp}:5000/api/health`, {
    Origin: `http://${lanIp}:5173`,
  });
  const allowOrigin = corsTest.headers ? corsTest.headers['access-control-allow-origin'] : null;
  if (allowOrigin === `http://${lanIp}:5173`) {
    console.log(`✔ CORS successfully returned 'access-control-allow-origin: http://${lanIp}:5173'`);
    results['LAN CORS Validation'] = 'PASS';
  } else {
    console.error(`✖ CORS check failed. Expected http://${lanIp}:5173, got: ${allowOrigin}`);
    results['LAN CORS Validation'] = 'FAIL';
  }

  // 3. Test Frontend Server over LAN IP
  console.log(`\n[Test 3] Testing Vite Frontend dev server via LAN IP...`);
  let frontendCheck = await checkHttp(`http://${lanIp}:5173`);
  let frontendProtocol = 'http';
  if (!frontendCheck.ok) {
    frontendCheck = await checkHttp(`https://${lanIp}:5173`);
    frontendProtocol = 'https';
  }
  if (frontendCheck.ok) {
    console.log(`✔ Vite frontend server reachable over LAN IP (${frontendProtocol.toUpperCase()} ${frontendCheck.statusCode})`);
    results['Frontend LAN Binding'] = 'PASS';
  } else {
    console.error(`✖ Vite frontend server not reachable over LAN IP:`, frontendCheck.error || frontendCheck.statusCode);
    results['Frontend LAN Binding'] = 'FAIL';
  }

  // 4. Test Socket.IO signaling connection directly over LAN IP
  console.log(`\n[Test 4] Testing Socket.IO signaling connection directly over http://${lanIp}:5000...`);
  const testRoomId = `lan-test-${Math.random().toString(36).substring(7)}`;
  let socketConnected = false;
  let roomJoined = false;

  try {
    const socket = await new Promise((resolve, reject) => {
      const s = io(`http://${lanIp}:5000`, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        extraHeaders: {
          Origin: `http://${lanIp}:5173`,
        },
      });
      s.on('connect', () => {
        socketConnected = true;
        resolve(s);
      });
      s.on('connect_error', (err) => reject(err));
    });

    console.log(`✔ Socket.IO connected successfully over LAN IP (Socket ID: ${socket.id})`);

    await new Promise((resolve) => {
      socket.emit('join-room', { roomId: testRoomId, displayName: 'LAN Tester' }, (res) => {
        if (res && res.success) {
          roomJoined = true;
          console.log(`✔ Successfully joined room '${testRoomId}' over LAN Socket.IO connection.`);
        }
        resolve();
      });
    });

    socket.disconnect();
    results['LAN Socket.IO Signaling'] = (socketConnected && roomJoined) ? 'PASS' : 'FAIL';
  } catch (err) {
    console.error(`✖ Socket.IO connection over LAN IP failed:`, err.message);
    results['LAN Socket.IO Signaling'] = 'FAIL';
  }

  cleanup();

  console.log('\n====================================================');
  console.log('📊 LAN VERIFICATION SUMMARY');
  console.log('====================================================');
  console.table(results);

  const allPassed = Object.values(results).every((status) => status === 'PASS');
  if (allPassed) {
    console.log('🎉 ALL LAN NETWORK VERIFICATIONS PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME LAN NETWORK VERIFICATIONS FAILED!\n');
    process.exit(1);
  }
}

runLanTest().catch((err) => {
  cleanup();
  console.error('LAN Test script failed:', err);
  process.exit(1);
});
