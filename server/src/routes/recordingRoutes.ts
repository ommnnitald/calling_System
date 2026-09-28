import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { isDbConnected } from '../db.js';
import { Recording } from '../models/Recording.js';
import { fallbackStore } from '../utils/fallbackStore.js';

export const recordingRouter = Router();

// Resolve storage directory for recording files reliably across root and server cwd
export const RECORDINGS_DIR = (() => {
  if (path.basename(process.cwd()) === 'server') {
    return path.resolve(process.cwd(), 'recordings');
  }
  if (fs.existsSync(path.resolve(process.cwd(), 'server'))) {
    return path.resolve(process.cwd(), 'server', 'recordings');
  }
  return path.resolve(process.cwd(), 'recordings');
})();

if (!fs.existsSync(RECORDINGS_DIR)) {
  try {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  } catch (err) {
    console.error('[Recordings] Failed to create directory:', err);
  }
}

// Upload a new recording video file
recordingRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const roomId = (req.headers['x-room-id'] || req.query.roomId || 'unknown-room') as string;
    const durationSeconds = Number(req.headers['x-duration'] || req.query.duration || 0);
    const hostName = (req.headers['x-host-name'] || req.query.hostName || 'Host') as string;
    const hostUserId = (req.headers['x-user-id'] || req.query.userId || '') as string;
    const mimeType = (req.headers['content-type'] || 'video/webm').split(';')[0];
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

    // Verify buffer data (reject empty or corrupt files less than 1KB)
    const buffer = req.body;
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1024) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recording: No video data received or file is empty (minimum 1 KB required).',
      });
    }

    const cleanRoom = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = Date.now();
    const fileName = `StreamCall-${cleanRoom}-${timestamp}.${ext}`;
    const filePath = path.join(RECORDINGS_DIR, fileName);

    // Save video file to disk
    fs.writeFileSync(filePath, buffer);
    const fileSize = buffer.length;

    console.log(`[Recordings] Saved recording to disk: ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB, duration: ${durationSeconds}s)`);

    let savedRecord: any;

    if (isDbConnected()) {
      const rec = new Recording({
        roomId: cleanRoom,
        hostUserId: hostUserId || undefined,
        hostName,
        fileName,
        fileSize,
        durationSeconds,
        mimeType,
      });
      await rec.save();
      savedRecord = {
        id: rec._id.toString(),
        roomId: rec.roomId,
        hostUserId: rec.hostUserId,
        hostName: rec.hostName,
        fileName: rec.fileName,
        fileSize: rec.fileSize,
        durationSeconds: rec.durationSeconds,
        mimeType: rec.mimeType,
        createdAt: rec.createdAt,
      };
    } else {
      savedRecord = fallbackStore.saveRecording({
        roomId: cleanRoom,
        hostUserId: hostUserId || undefined,
        hostName,
        fileName,
        filePath,
        fileSize,
        durationSeconds,
        mimeType,
      });
    }

    return res.status(201).json({
      success: true,
      recording: savedRecord,
      message: 'Meeting recording uploaded and saved successfully.',
    });
  } catch (err: any) {
    console.error('[Recording Upload Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to process recording upload.',
    });
  }
});

// Get recordings for authenticated host
recordingRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (isDbConnected()) {
      const queryOr: any[] = [{ hostUserId: userId }];
      if (userName && userName.trim()) {
        queryOr.push({ hostName: userName.trim() });
      }

      const recs = await Recording.find({ $or: queryOr })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const formatted = recs.map((r: any) => ({
        id: r._id.toString(),
        roomId: r.roomId,
        hostUserId: r.hostUserId,
        hostName: r.hostName,
        fileName: r.fileName,
        fileSize: r.fileSize,
        durationSeconds: r.durationSeconds,
        mimeType: r.mimeType,
        createdAt: r.createdAt,
      }));

      return res.json({
        success: true,
        recordings: formatted,
      });
    } else {
      const recs = fallbackStore.getRecordingsForUser(userId, userName);
      return res.json({
        success: true,
        recordings: recs.map((r) => ({
          id: r.id,
          roomId: r.roomId,
          hostUserId: r.hostUserId,
          hostName: r.hostName,
          fileName: r.fileName,
          fileSize: r.fileSize,
          durationSeconds: r.durationSeconds,
          mimeType: r.mimeType,
          createdAt: r.createdAt,
        })),
      });
    }
  } catch (err: any) {
    console.error('[Get Recordings Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch recordings.',
    });
  }
});

// Get recordings for a specific room
recordingRouter.get('/room/:roomId', async (req: Request, res: Response) => {
  try {
    const cleanRoom = String(req.params.roomId || '').trim();

    if (isDbConnected()) {
      const recs = await Recording.find({ roomId: cleanRoom })
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        success: true,
        recordings: recs.map((r: any) => ({
          id: r._id.toString(),
          roomId: r.roomId,
          hostUserId: r.hostUserId,
          hostName: r.hostName,
          fileName: r.fileName,
          fileSize: r.fileSize,
          durationSeconds: r.durationSeconds,
          mimeType: r.mimeType,
          createdAt: r.createdAt,
        })),
      });
    } else {
      const recs = fallbackStore.getRecordingsForRoom(cleanRoom);
      return res.json({
        success: true,
        recordings: recs,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch room recordings.',
    });
  }
});

// Stream recording video file with HTTP 206 Partial Content (Seekable HTML5 playback)
recordingRouter.get('/:id/stream', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    let fileName = '';
    let mimeType = 'video/webm';
    let customFilePath = '';

    if (isDbConnected()) {
      const rec = await Recording.findById(id);
      if (!rec) {
        return res.status(404).json({ success: false, message: 'Recording not found.' });
      }
      fileName = rec.fileName;
      mimeType = rec.mimeType || 'video/webm';
    } else {
      const rec = fallbackStore.getRecordingById(id);
      if (!rec) {
        return res.status(404).json({ success: false, message: 'Recording not found.' });
      }
      fileName = rec.fileName;
      mimeType = rec.mimeType || 'video/webm';
      if ((rec as any).filePath) {
        customFilePath = (rec as any).filePath;
      }
    }

    let filePath = path.join(RECORDINGS_DIR, fileName);
    if (!fs.existsSync(filePath) && customFilePath && fs.existsSync(customFilePath)) {
      filePath = customFilePath;
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Recording file does not exist on disk.' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    if (fileSize === 0) {
      return res.status(404).json({ success: false, message: 'Recording file on disk is empty.' });
    }
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    console.error('[Stream Recording Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Streaming failed.',
    });
  }
});

// Download recording video file directly
recordingRouter.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    let fileName = '';
    let roomId = 'meeting';
    let customFilePath = '';

    if (isDbConnected()) {
      const rec = await Recording.findById(id);
      if (!rec) {
        return res.status(404).json({ success: false, message: 'Recording not found.' });
      }
      fileName = rec.fileName;
      roomId = rec.roomId;
    } else {
      const rec = fallbackStore.getRecordingById(id);
      if (!rec) {
        return res.status(404).json({ success: false, message: 'Recording not found.' });
      }
      fileName = rec.fileName;
      roomId = rec.roomId;
      if ((rec as any).filePath) {
        customFilePath = (rec as any).filePath;
      }
    }

    let filePath = path.join(RECORDINGS_DIR, fileName);
    if (!fs.existsSync(filePath) && customFilePath && fs.existsSync(customFilePath)) {
      filePath = customFilePath;
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Recording file not found on disk.' });
    }

    return res.download(filePath, fileName);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Download failed.',
    });
  }
});

// Delete recording
recordingRouter.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.user?.id;
    const userName = req.user?.name;

    if (isDbConnected()) {
      const rec = await Recording.findById(id);
      if (!rec) {
        return res.status(404).json({ success: false, message: 'Recording not found.' });
      }
      const filePath = path.join(RECORDINGS_DIR, rec.fileName);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (_) {}
      await Recording.findByIdAndDelete(id);
    } else {
      const deleted = fallbackStore.deleteRecording(id, userId, userName);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Recording not found or unauthorized.' });
      }
    }

    return res.json({
      success: true,
      message: 'Recording deleted successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Delete failed.',
    });
  }
});
