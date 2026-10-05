export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${Math.ceil(seconds % 60)}s`;
}

export function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  return `${Math.max(minutes, 1)}m left`;
}

const MAX_HOURS = 90 * 24;

const PRESET_HOURS: Record<string, number> = { '1h': 1, '1d': 24, '7d': 168, '30d': 720, '90d': MAX_HOURS };

export function getExpirationHours(option: string, customValue: number, customUnit: 'hours' | 'days'): number {
  if (option === 'custom') {
    const hours = customValue * (customUnit === 'hours' ? 1 : 24);
    return Math.min(Math.max(Math.round(hours), 1), MAX_HOURS);
  }
  return PRESET_HOURS[option] ?? PRESET_HOURS['7d'];
}
