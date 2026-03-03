import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SESSION_FILE_NAME = '.mconnect-session.json';

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
