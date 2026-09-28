import { io } from 'socket.io-client';
import { spawn } from 'child_process';
import http from 'http';

const SERVER_URL = 'http://localhost:5000';
const TEST_ROOM = 'test-room-' + Math.random().toString(36).substring(7);

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    }).on('error', () => resolve(false));
  });
}

let serverProc = null;

async function ensureServerRunning() {
  const isServerUp = await checkUrl(`${SERVER_URL}/api/health`);
  if (!isServerUp) {
    console.log('[Test Setup] Starting backend signaling server...');
    serverProc = spawn('npm', ['run', 'dev:server'], { shell: true, stdio: 'ignore' });
    let attempts = 0;
    while (!(await checkUrl(`${SERVER_URL}/api/health`)) && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
    }
  }
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, { forceNew: true, timeout: 5000 });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

async function runTest() {
  await ensureServerRunning();
  console.log(`[Test] Connecting to ${SERVER_URL} for room ${TEST_ROOM}`);

  // Join 10 participants sequentially
  const sockets = [];
  const joinedFlags = [];

  for (let i = 1; i <= 10; i++) {
    const s = await connectSocket();
    sockets.push(s);
    let success = false;
    await new Promise((resolve) => {
      s.emit('join-room', { roomId: TEST_ROOM, displayName: `User${i}` }, (res) => {
        success = res.success;
        resolve();
      });
    });
    joinedFlags.push(success);
    console.log(`Participant ${i} join response: ${success ? 'SUCCESS' : 'FAILED'}`);
  }

  // Test offer & answer forwarding between Socket 1 and Socket 2
  let offerReceived = false;
  let answerReceived = false;

  await new Promise((resolve) => {
    sockets[1].on('offer', (data) => {
      console.log('Socket 2 received offer from:', data.from, 'senderName:', data.senderName);
      offerReceived = true;
      sockets[1].emit('answer', { to: data.from, sdp: { type: 'answer', sdp: 'dummy-answer-sdp' } });
    });

    sockets[0].on('answer', (data) => {
      console.log('Socket 1 received answer from:', data.from);
      answerReceived = true;
      resolve();
    });

    sockets[0].emit('offer', { to: sockets[1].id, sdp: { type: 'offer', sdp: 'dummy-offer-sdp' } });
  });

  // Socket 11 attempts to join full room (10/10 full)
  const socket11 = await connectSocket();
  console.log('Socket 11 connected:', socket11.id);
  let roomFullDetected = false;

  await new Promise((resolve) => {
    socket11.on('room-full', (data) => {
      console.log('Socket 11 received room-full event:', data);
      roomFullDetected = true;
      resolve();
    });

    socket11.emit('join-room', { roomId: TEST_ROOM, displayName: 'Participant11' }, (res) => {
      console.log('Socket 11 join response:', res);
      if (!res.success && res.reason === 'room_full') {
        roomFullDetected = true;
        resolve();
      }
    });
  });

  sockets.forEach((s) => s.disconnect());
  socket11.disconnect();

  const all10Joined = joinedFlags.every((v) => v === true);
  console.log('\n--- TEST SUMMARY ---');
  console.log('Participants 1 to 10 joined:', all10Joined ? 'PASS' : 'FAIL');
  console.log('Offer forwarded between peers:', offerReceived ? 'PASS' : 'FAIL');
  console.log('Answer forwarded between peers:', answerReceived ? 'PASS' : 'FAIL');
  console.log('Room-full (11th user) rejected:', roomFullDetected ? 'PASS' : 'FAIL');

  if (serverProc) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProc.pid.toString(), '/f', '/t']);
      } else {
        serverProc.kill();
      }
    } catch (_) {}
  }

  if (all10Joined && offerReceived && answerReceived && roomFullDetected) {
    console.log('\nALL MULTI-PARTY SIGNALING & ROOM CAPACITY (10 PEERS) TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('\nSOME TESTS FAILED!');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test execution error:', err);
  if (serverProc) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProc.pid.toString(), '/f', '/t']);
      } else {
        serverProc.kill();
      }
    } catch (_) {}
  }
  process.exit(1);
});

