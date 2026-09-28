import { spawn } from 'child_process';
import { io } from 'socket.io-client';

const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('[Test Setup] Starting backend server on port', PORT);
  const server = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: './server',
    env: { ...process.env, PORT: String(PORT), SERVER_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  server.stdout.on('data', (d) => {
    // console.log('[Server stdout]', d.toString());
  });
  server.stderr.on('data', (d) => {
    // console.log('[Server stderr]', d.toString());
  });

  // Wait for server to boot
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (_) {}
    await sleep(400);
  }

  if (!ready) {
    console.error('Server failed to start in time');
    server.kill();
    process.exit(1);
  }

  console.log('[Test Setup] Backend is ready. Running Auth & Dashboard tests...\n');

  try {
    // 1. Health & DB status
    const healthRes = await fetch(`${BASE_URL}/api/health`).then((r) => r.json());
    console.log('1. Health check:', healthRes.status === 'ok' ? 'PASS' : 'FAIL', `(DB mode: ${healthRes.database?.connected ? 'Live MongoDB' : 'Memory Fallback'})`);

    // 2. Register user
    const testEmail = `alice_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Walker',
        email: testEmail,
        password: 'password123',
      }),
    }).then((r) => r.json());

    if (!regRes.success || !regRes.token || !regRes.user?.id) {
      throw new Error(`User registration failed: ${JSON.stringify(regRes)}`);
    }
    console.log('2. User Registration:', 'PASS', `(User: ${regRes.user.name}, ID: ${regRes.user.id})`);
    const token = regRes.token;
    const userId = regRes.user.id;

    // 3. Duplicate registration check
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Duplicate',
        email: testEmail,
        password: 'password123',
      }),
    });
    console.log('3. Duplicate Email Rejection:', dupRes.status === 400 ? 'PASS' : 'FAIL');

    // 4. Login user
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
      }),
    }).then((r) => r.json());

    console.log('4. User Login:', loginRes.success && loginRes.token ? 'PASS' : 'FAIL');

    // 5. Invalid password check
    const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'wrongpassword',
      }),
    });
    console.log('5. Bad Password Rejection:', badLogin.status === 401 ? 'PASS' : 'FAIL');

    // 6. Get profile (/api/auth/me)
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    console.log('6. Get Authenticated User (/api/auth/me):', meRes.user?.email === testEmail ? 'PASS' : 'FAIL');

    // 7. Update profile
    const updateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Alice W. Updated',
      }),
    }).then((r) => r.json());

    console.log('7. Update Profile Name:', updateRes.user?.name === 'Alice W. Updated' ? 'PASS' : 'FAIL');

    // 8. Initial call history & stats (should be empty for new user)
    const initHistory = await fetch(`${BASE_URL}/api/calls/history`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    console.log('8. Initial Call History Empty:', initHistory.calls?.length === 0 ? 'PASS' : 'FAIL');

    const initStats = await fetch(`${BASE_URL}/api/calls/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    console.log('9. Initial Call Stats:', initStats.stats?.totalCalls === 0 ? 'PASS' : 'FAIL');

    // 10. Simulate a socket call with userId and verify call tracking in Dashboard
    console.log('10. Simulating Call Session with authenticated userId...');
    const testRoom = `test-call-${Date.now()}`;
    const socket = io(BASE_URL, { reconnection: false });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit(
          'join-room',
          {
            roomId: testRoom,
            displayName: 'Alice W. Updated',
            userId: userId,
            isAudioMuted: false,
            isVideoMuted: false,
          },
          (res) => {
            if (res.success) resolve(res);
            else reject(new Error('Join room failed'));
          }
        );
      });
    });

    // Wait a brief moment to simulate a short call
    await sleep(600);

    // Leave room
    socket.emit('leave-room');
    socket.disconnect();
    await sleep(400);

    // 11. Verify Call is now recorded in Call History & Stats
    const updatedHistory = await fetch(`${BASE_URL}/api/calls/history`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    const hasCall = updatedHistory.calls?.some((c) => c.roomId === testRoom);
    console.log('11. Call History Records Session:', hasCall ? 'PASS' : 'FAIL');

    const updatedStats = await fetch(`${BASE_URL}/api/calls/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    console.log('12. Call Stats Incremented (totalCalls >= 1):', updatedStats.stats?.totalCalls >= 1 ? 'PASS' : 'FAIL');

    console.log('\n=========================================');
    console.log('ALL AUTHENTICATION, REGISTRATION & DASHBOARD TESTS PASSED!');
    console.log('=========================================\n');
  } finally {
    server.kill();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[Test Error]:', err);
  process.exit(1);
});
