import { User, CallHistoryItem, CallStats, RecordingItem } from '../types';

const TOKEN_KEY = 'streamcall_auth_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

import { getServerUrl } from './config';

function getApiBaseUrl(): string {
  return getServerUrl();
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        message: data.message || `Request failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network request failed.',
    };
  }
}

export const api = {
  // Auth endpoints
  async register(name: string, email: string, password: string) {
    return apiRequest<{ success: boolean; token: string; user: User; message?: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }
    );
  },

  async login(email: string, password: string) {
    return apiRequest<{ success: boolean; token: string; user: User; message?: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
  },

  async getMe() {
    return apiRequest<{ success: boolean; user: User }>('/api/auth/me', {
      method: 'GET',
    });
  },

  async updateProfile(name: string, avatarColor?: string) {
    return apiRequest<{ success: boolean; user: User; message?: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, avatarColor }),
    });
  },

  // Call history & stats endpoints
  async getCallHistory() {
    return apiRequest<{ success: boolean; calls: CallHistoryItem[]; warning?: string }>(
      '/api/calls/history',
      {
        method: 'GET',
      }
    );
  },

  async getCallStats() {
    return apiRequest<{ success: boolean; stats: CallStats }>('/api/calls/stats', {
      method: 'GET',
    });
  },

  // Health check including MongoDB connection status
  async getHealth() {
    return apiRequest<{
      status: string;
      database: { connected: boolean; uri: string; error?: string };
    }>('/api/health', {
      method: 'GET',
    });
  },

  // Meeting recordings endpoints
  async uploadRecording(
    blob: Blob,
    metadata: {
      roomId: string;
      durationSeconds: number;
      hostName: string;
      userId?: string;
    }
  ) {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': blob.type || 'video/webm',
      'x-room-id': metadata.roomId,
      'x-duration': String(metadata.durationSeconds),
      'x-host-name': metadata.hostName,
    };
    if (metadata.userId) {
      headers['x-user-id'] = metadata.userId;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const url = `${getApiBaseUrl()}/api/recordings/upload`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: blob,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Failed to upload recording.',
        };
      }
      return {
        success: true,
        data: data.recording as RecordingItem,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Upload network error.',
      };
    }
  },

  async getRecordings() {
    return apiRequest<{ success: boolean; recordings: RecordingItem[] }>(
      '/api/recordings',
      {
        method: 'GET',
      }
    );
  },

  async getRoomRecordings(roomId: string) {
    return apiRequest<{ success: boolean; recordings: RecordingItem[] }>(
      `/api/recordings/room/${encodeURIComponent(roomId)}`,
      {
        method: 'GET',
      }
    );
  },

  async deleteRecording(id: string) {
    return apiRequest<{ success: boolean; message?: string }>(
      `/api/recordings/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  getRecordingStreamUrl(id: string): string {
    return `${getApiBaseUrl()}/api/recordings/${encodeURIComponent(id)}/stream`;
  },

  getRecordingDownloadUrl(id: string): string {
    return `${getApiBaseUrl()}/api/recordings/${encodeURIComponent(id)}/download`;
  },
};
