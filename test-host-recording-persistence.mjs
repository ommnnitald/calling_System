import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';

const PORT = 5003;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const s = io(BASE_URL, { reconnection: false, forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (err) => reject(err));
  });
}

async function runTest() {
  console.log('[Verification] Starting backend server on port', PORT);
  const server = spawn('cmd.exe', ['/c', 'npm run dev:server'], {
    env: { ...process.env, PORT: String(PORT), SERVER_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  server.stdout?.on('data', (d) => {
    // console.log('[Server stdout]', d.toString());
  });
  server.stderr?.on('data', (d) => {
    // console.error('[Server stderr]', d.toString());
  });

  // Wait for server health endpoint
  let ready = false;
  for (let i = 0; i < 30; i++) {
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

  console.log('[Verification] Server is ready on port', PORT);

  try {
    // 1. Register a test user
    const testEmail = `host_test_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Host Alice',
        email: testEmail,
        password: 'password123',
      }),
    }).then((r) => r.json());

    if (!regRes.success || !regRes.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    }
    const token = regRes.token;
    const userId = regRes.user.id;
    console.log('✓ 1. User registered successfully:', regRes.user.name, '(ID:', userId, ')');

    // 2. Connect Socket 1 (Host Alice)
    const testRoom = `room-test-${Date.now()}`;
    const hostSocket = await connectSocket();
    let hostJoinRes = null;
    await new Promise((resolve) => {
      hostSocket.emit(
        'join-room',
        {
          roomId: testRoom,
          displayName: 'Host Alice',
          userId: userId,
          isAudioMuted: false,
          isVideoMuted: false,
        },
        (res) => {
          hostJoinRes = res;
          resolve();
        }
      );
    });

    console.log('✓ 2. Host joined room:', testRoom);
    console.log('   - isHost:', hostJoinRes.isHost, '(Expected: true)');
    if (hostJoinRes.isHost !== true) {
      throw new Error(`Expected hostJoinRes.isHost === true, got: ${hostJoinRes.isHost}`);
    }

    // 3. Connect Socket 2 (Joinee Bob)
    const joineeSocket = await connectSocket();
    let joineeJoinRes = null;
    await new Promise((resolve) => {
      joineeSocket.emit(
        'join-room',
        {
          roomId: testRoom,
          displayName: 'Joinee Bob',
          isAudioMuted: false,
          isVideoMuted: false,
        },
        (res) => {
          joineeJoinRes = res;
          resolve();
        }
      );
    });

    console.log('✓ 3. Joinee joined room:', testRoom);
    console.log('   - isHost:', joineeJoinRes.isHost, '(Expected: false)');
    if (joineeJoinRes.isHost !== false) {
      throw new Error(`Expected joineeJoinRes.isHost === false, got: ${joineeJoinRes.isHost}`);
    }

    // 4. Test Joinee attempting to start recording -> MUST BE REJECTED
    let joineeRecordingError = null;
    joineeSocket.on('recording-error', (err) => {
      joineeRecordingError = err;
    });

    let joineeStartedBroadcast = false;
    joineeSocket.on('recording-started', () => {
      joineeStartedBroadcast = true;
    });

    joineeSocket.emit('start-recording', { hostName: 'Joinee Bob' });
    await sleep(400);

    console.log('✓ 4. Joinee attempted start-recording:');
    console.log('   - Received recording-error:', joineeRecordingError?.message);
    console.log('   - recording-started broadcast fired:', joineeStartedBroadcast, '(Expected: false)');
    if (!joineeRecordingError || joineeStartedBroadcast) {
      throw new Error('Joinee start-recording was not rejected as expected!');
    }

    // 5. Test Host starting recording -> MUST BE BROADCAST TO ALL PARTICIPANTS
    let hostStartedEvent = null;
    let joineeReceivedHostRecording = null;

    hostSocket.on('recording-started', (d) => {
      hostStartedEvent = d;
    });
    joineeSocket.on('recording-started', (d) => {
      joineeReceivedHostRecording = d;
    });

    hostSocket.emit('start-recording', { hostName: 'Host Alice' });
    await sleep(400);

    console.log('✓ 5. Host emitted start-recording:');
    console.log('   - Host received broadcast:', Boolean(hostStartedEvent));
    console.log('   - Joinee received broadcast:', Boolean(joineeReceivedHostRecording));
    if (!hostStartedEvent || !joineeReceivedHostRecording) {
      throw new Error('Host start-recording broadcast was not received by all peers!');
    }

    // 6. Test Joinee attempting to stop recording -> MUST BE REJECTED
    let stopEventReceived = false;
    hostSocket.on('recording-stopped', () => {
      stopEventReceived = true;
    });

    joineeSocket.emit('stop-recording', { hostName: 'Joinee Bob' });
    await sleep(400);

    console.log('✓ 6. Joinee attempted stop-recording:');
    console.log('   - Stopped broadcast fired:', stopEventReceived, '(Expected: false)');
    if (stopEventReceived) {
      throw new Error('Joinee was illegally permitted to stop host recording!');
    }

    // 7. Host stops recording -> MUST SUCCEED
    hostSocket.emit('stop-recording', { hostName: 'Host Alice' });
    await sleep(400);
    console.log('✓ 7. Host stopped recording successfully. (Stopped broadcast received:', stopEventReceived, ')');
    if (!stopEventReceived) {
      throw new Error('Host stop-recording did not broadcast!');
    }

    // 8. Test Host Departure & Host Reassignment
    let hostChangedEvent = null;
    joineeSocket.on('host-changed', (d) => {
      hostChangedEvent = d;
    });

    hostSocket.emit('leave-room');
    hostSocket.disconnect();
    await sleep(400);

    console.log('✓ 8. Host left room:');
    console.log('   - Joinee received host-changed:', Boolean(hostChangedEvent));
    console.log('   - New Host Socket ID matches Joinee Socket ID:', hostChangedEvent?.hostSocketId === joineeSocket.id);
    if (hostChangedEvent?.hostSocketId !== joineeSocket.id) {
      throw new Error('Joinee was not promoted to host upon original host departure!');
    }

    // 9. Joinee (now newly promoted host) leaves room -> ends call
    joineeSocket.emit('leave-room');
    joineeSocket.disconnect();
    await sleep(500);

    // 10. Verify Data Persistence in storage file & REST API
    const storePath = path.resolve('server', 'data', 'streamcall-store.json');
    const fileExists = fs.existsSync(storePath);
    console.log('✓ 9. Store file exists on disk:', fileExists, `(${storePath})`);
    if (!fileExists) {
      throw new Error(`Store file not found on disk at: ${storePath}`);
    }

    const raw = fs.readFileSync(storePath, 'utf-8');
    const diskData = JSON.parse(raw);
    const hasCallInDisk = diskData.calls?.some((c) => c.roomId === testRoom);
    console.log('   - Call record persisted to disk store:', hasCallInDisk);
    if (!hasCallInDisk) {
      throw new Error(`Call record for ${testRoom} was not saved in disk store!`);
    }

    // 11. Query /api/calls/history via authenticated token
    const historyRes = await fetch(`${BASE_URL}/api/calls/history`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    const hasCallInApi = historyRes.calls?.some((c) => c.roomId === testRoom);
    console.log('✓ 10. Call history returned via REST API:', hasCallInApi);
    console.log('   - Database mode reported:', historyRes.databaseMode);
    if (!hasCallInApi) {
      throw new Error(`Call history for room ${testRoom} was not returned for host user!`);
    }

    console.log('\n======================================================');
    console.log('ALL 10 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
    console.log('======================================================\n');
  } finally {
    server.kill();
  }
}

runTest().catch((err) => {
  console.error('[Verification Failed]:', err);
  process.exit(1);
});
