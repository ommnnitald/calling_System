import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';
import { authenticateToken, generateToken, AuthRequest } from '../middleware/auth.js';
import { getDbStatus, isDbConnected } from '../db.js';
import { fallbackStore, SafeUser } from '../utils/fallbackStore.js';

export const authRouter = Router();

// DB and Auth Status endpoint
authRouter.get('/status', (req: Request, res: Response) => {
  const dbStatus = getDbStatus();
  return res.json({
    success: true,
    database: {
      connected: dbStatus.isConnected,
      mode: dbStatus.mode,
      uri: dbStatus.uri,
      error: dbStatus.error,
    },
  });
});

// Register new user
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Display name is required.',
      });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    let safeUser: SafeUser;

    if (isDbConnected()) {
      // Use Live MongoDB
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please log in instead.',
        });
      }

      const user = new User({
        name: cleanName,
        email: cleanEmail,
        password,
      });

      await user.save();
      safeUser = user.toSafeObject();
    } else {
      // Use Fallback In-Memory Store
      try {
        safeUser = await fallbackStore.createUser(cleanName, cleanEmail, password);
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Registration failed.',
        });
      }
    }

    const token = generateToken(safeUser);
    const dbStatus = getDbStatus();

    console.log(`[Auth] Registered new user: ${safeUser.name} (${safeUser.email}) [Mode: ${dbStatus.mode}]`);

    return res.status(201).json({
      success: true,
      token,
      user: safeUser,
      databaseMode: dbStatus.mode,
      message: 'Account created successfully.',
    });
  } catch (err: any) {
    console.error('[Auth Register Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error during registration.',
    });
  }
});

// Login existing user
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    let safeUser: SafeUser | null = null;

    if (isDbConnected()) {
      // Use Live MongoDB
      const user = await User.findOne({ email: cleanEmail }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      safeUser = user.toSafeObject();
    } else {
      // Use Fallback In-Memory Store
      safeUser = await fallbackStore.authenticateUser(cleanEmail, password);
      if (!safeUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }
    }

    const token = generateToken(safeUser);
    const dbStatus = getDbStatus();

    console.log(`[Auth] User logged in: ${safeUser.name} (${safeUser.email}) [Mode: ${dbStatus.mode}]`);

    return res.json({
      success: true,
      token,
      user: safeUser,
      databaseMode: dbStatus.mode,
      message: 'Logged in successfully.',
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error during login.',
    });
  }
});

// Get current authenticated user
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let safeUser: SafeUser | null = null;

    if (isDbConnected()) {
      const user = await User.findById(userId);
      if (user) {
        safeUser = user.toSafeObject();
      }
    } else {
      safeUser = fallbackStore.getUserById(userId);
    }

    if (!safeUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    return res.json({
      success: true,
      user: safeUser,
      databaseMode: getDbStatus().mode,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error fetching user profile.',
    });
  }
});

// Update profile
authRouter.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { name, avatarColor } = req.body || {};
    let safeUser: SafeUser | null = null;

    if (isDbConnected()) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (name && typeof name === 'string' && name.trim().length > 0) {
        user.name = name.trim().substring(0, 50);
      }
      if (avatarColor && typeof avatarColor === 'string') {
        user.avatarColor = avatarColor;
      }

      await user.save();
      safeUser = user.toSafeObject();
    } else {
      safeUser = fallbackStore.updateProfile(userId, name, avatarColor);
      if (!safeUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
    }

    return res.json({
      success: true,
      user: safeUser,
      message: 'Profile updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Error updating profile.',
    });
  }
});
