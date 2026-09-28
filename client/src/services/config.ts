export const DEFAULT_LAN_SERVER_URL = 'http://192.168.1.137:5000';
export const SERVER_URL_KEY = 'streamcall_server_url';

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port === '')
  );
}

export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(SERVER_URL_KEY);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
    const envUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || import.meta.env.VITE_SERVER_URL;
    if (envUrl) return envUrl.replace(/\/+$/, '');

    if (isNativeApp()) {
      return DEFAULT_LAN_SERVER_URL;
    }

    return window.location.origin;
  }
  return 'http://localhost:5000';
}

export function setServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem(SERVER_URL_KEY);
  } else {
    localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
  }
}
