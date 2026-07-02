import { existsSync, statSync, createReadStream } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANDIDATE_WEB_ROOTS = [
  resolve(__dirname, '../../assets/web'),
  resolve(__dirname, '../assets/web'),
  resolve(process.cwd(), 'packages/cli/assets/web'),
  resolve(process.cwd(), 'apps/web/out'),
];

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function findWebRoot(): string | null {
  for (const root of CANDIDATE_WEB_ROOTS) {
    if (existsSync(join(root, 'index.html'))) return root;
  }
  return null;
}

function safeAssetPath(root: string, pathname: string): string | null {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let decoded: string;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    return null;
  }
  const normalizedPath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = resolve(root, `.${normalizedPath}`);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) return null;
  return resolved;
}

export function hasStaticWebClient(): boolean {
  return findWebRoot() !== null;
}

export function serveStaticWebClient(
  pathname: string,
  res: ServerResponse,
  options: { allowIndex: boolean } = { allowIndex: false }
): boolean {
  const root = findWebRoot();
  if (!root) return false;
  if (!options.allowIndex && (pathname === '/' || pathname === '/index.html')) return false;

  const assetPath = safeAssetPath(root, pathname);
  if (!assetPath || !existsSync(assetPath)) return false;
  const stat = statSync(assetPath);
  if (!stat.isFile()) return false;

  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(assetPath)] || 'application/octet-stream',
    'Cache-Control': pathname.includes('/_next/static/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
  });
  createReadStream(assetPath).pipe(res);
  return true;
}
