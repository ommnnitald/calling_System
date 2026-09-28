import os from 'os';

/**
 * Automatically discovers the primary non-internal IPv4 address for LAN access.
 * Scans network interfaces, prioritizing Wi-Fi and Ethernet adapters.
 */
export function getLanIp(): string | null {
  const interfaces = os.networkInterfaces();

  // Preferred interface names to inspect first
  const priorityInterfaces = ['Wi-Fi', 'Ethernet', 'en0', 'wlan0', 'eth0'];

  // Check priority interfaces first
  for (const name of priorityInterfaces) {
    const addresses = interfaces[name];
    if (addresses) {
      for (const addr of addresses) {
        if (
          (addr.family === 'IPv4' || (addr.family as any) === 4) &&
          !addr.internal &&
          addr.address !== '127.0.0.1'
        ) {
          return addr.address;
        }
      }
    }
  }

  // Fallback check across all available interfaces
  for (const name of Object.keys(interfaces)) {
    const addresses = interfaces[name];
    if (!addresses) continue;
    for (const addr of addresses) {
      if (
        (addr.family === 'IPv4' || (addr.family as any) === 4) &&
        !addr.internal &&
        addr.address !== '127.0.0.1'
      ) {
        return addr.address;
      }
    }
  }

  return null;
}
