import {
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';

const GROUPS: [LucideIcon, string[]][] = [
  [FileImage, ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'heic', 'bmp', 'avif']],
  [FileVideo, ['mp4', 'mov', 'avi', 'mkv', 'webm']],
  [FileAudio, ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']],
  [FileArchive, ['zip', 'rar', '7z', 'tar', 'gz']],
  [FileSpreadsheet, ['xls', 'xlsx', 'csv', 'numbers']],
  [FileCode, ['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'java']],
  [FileText, ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'pages', 'ppt', 'pptx']],
];

export function getExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getFileIcon(name: string): LucideIcon {
  const ext = getExtension(name);
  return GROUPS.find(([, exts]) => exts.includes(ext))?.[0] ?? FileIcon;
}
