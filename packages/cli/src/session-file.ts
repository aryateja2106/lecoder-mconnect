import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SESSION_FILE_NAME = '.mconnect-session.json';
const REGISTRY_DIR = join(homedir(), '.mconnect', 'sessions');

export interface SessionFileData {
  sessionId: string;
  pairingCode: string;
  url: string;
  connectUrl: string;
  token: string;
  port: number;
  startedAt: string;
  pid: number;
}

export interface RegisteredSession extends SessionFileData {
  workDir: string;
}

export interface SessionEntry {
  data: RegisteredSession;
  alive: boolean;
}

export function getSessionFilePath(workDir: string): string {
  return join(workDir, SESSION_FILE_NAME);
}

export function writeSessionFile(workDir: string, data: SessionFileData): void {
  const filePath = getSessionFilePath(workDir);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function readSessionFile(workDir: string): SessionFileData | null {
  const filePath = getSessionFilePath(workDir);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function removeSessionFile(workDir: string): void {
  const filePath = getSessionFilePath(workDir);
  try {
    unlinkSync(filePath);
  } catch {
    // File may not exist
  }
}

// --- Central Session Registry ---

function ensureRegistryDir(): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

export function registerSession(data: RegisteredSession): void {
  ensureRegistryDir();
  const filePath = join(REGISTRY_DIR, `${data.sessionId}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function unregisterSession(sessionId: string): void {
  const filePath = join(REGISTRY_DIR, `${sessionId}.json`);
  try {
    unlinkSync(filePath);
  } catch {
    // File may not exist
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function listRegisteredSessions(): SessionEntry[] {
  ensureRegistryDir();
  const entries: SessionEntry[] = [];

  let files: string[];
  try {
    files = readdirSync(REGISTRY_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return entries;
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(REGISTRY_DIR, file), 'utf-8');
      const data: RegisteredSession = JSON.parse(raw);
      entries.push({
        data,
        alive: isPidAlive(data.pid),
      });
    } catch {
      // Skip malformed files
    }
  }

  return entries;
}

export function cleanDeadSessions(): number {
  const sessions = listRegisteredSessions();
  let cleaned = 0;

  for (const session of sessions) {
    if (!session.alive) {
      unregisterSession(session.data.sessionId);
      cleaned++;
    }
  }

  return cleaned;
}
