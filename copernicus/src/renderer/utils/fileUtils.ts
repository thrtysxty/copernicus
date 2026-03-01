export const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'avif',
])

export const BINARY_EXTENSIONS = new Set([
  'db', 'db-shm', 'db-wal', 'sqlite', 'sqlite3',
  'dmg', 'pkg', 'exe', 'dll', 'so', 'dylib',
  'wasm', 'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'pdf', 'bin', 'a', 'o', 'class', 'pyc',
  'mp4', 'mp3', 'wav', 'mov', 'avi', 'mkv',
])

export function classifyFile(filePath: string): 'code' | 'canvas' | 'binary' | 'svg' {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'svg') return 'svg'
  if (IMAGE_EXTENSIONS.has(ext)) return 'canvas'
  if (BINARY_EXTENSIONS.has(ext)) return 'binary'
  return 'code'
}
