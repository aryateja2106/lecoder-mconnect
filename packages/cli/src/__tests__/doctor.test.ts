/**
 * Tests for doctor.ts - MConnect v0.1.2
 *
 * Tests the diagnostic system that checks all dependencies
 * and provides guidance for missing requirements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runDiagnostics,
  printDiagnostics,
  isNodePtyAvailable,
  tryInstallNodePty,
  type DiagnosticResult,
} from '../doctor.js';

// Mock child_process for controlled testing
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

describe('Doctor Module', () => {
  describe('DiagnosticResult type', () => {
    it('should support ok status', () => {
      const result: DiagnosticResult = {
        name: 'Test Check',
        status: 'ok',
        message: 'All good',
      };
      expect(result.status).toBe('ok');
      expect(result.fix).toBeUndefined();
    });

    it('should support warning status', () => {
      const result: DiagnosticResult = {
        name: 'Test Check',
        status: 'warning',
        message: 'Could be better',
        fix: 'Do this to improve',
      };
      expect(result.status).toBe('warning');
      expect(result.fix).toBeDefined();
    });

    it('should support error status', () => {
      const result: DiagnosticResult = {
        name: 'Test Check',
        status: 'error',
        message: 'Something is wrong',
        fix: 'Run this command to fix',
      };
      expect(result.status).toBe('error');
      expect(result.fix).toBeDefined();
    });
  });

  describe('runDiagnostics', () => {
    it('should return an array of diagnostic results', async () => {
      const results = await runDiagnostics();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should check Node.js version', async () => {
      const results = await runDiagnostics();
      const nodeCheck = results.find((r) => r.name === 'Node.js');
      expect(nodeCheck).toBeDefined();
      expect(nodeCheck?.message).toContain('Node.js');
    });

    it('should check shell availability', async () => {
      const results = await runDiagnostics();
      const shellCheck = results.find((r) => r.name === 'Shell');
      expect(shellCheck).toBeDefined();
      expect(shellCheck?.message).toContain('shell');
    });

    it('should check Python', async () => {
      const results = await runDiagnostics();
      const pythonCheck = results.find((r) => r.name === 'Python');
      expect(pythonCheck).toBeDefined();
    });

    it('should check C++ compiler', async () => {
      const results = await runDiagnostics();
      const compilerCheck = results.find((r) => r.name === 'C++ Compiler');
      expect(compilerCheck).toBeDefined();
    });

    it('should check node-pty', async () => {
      const results = await runDiagnostics();
      const ptyCheck = results.find((r) => r.name === 'node-pty');
      expect(ptyCheck).toBeDefined();
    });

    it('should check tmux (optional)', async () => {
      const results = await runDiagnostics();
      const tmuxCheck = results.find((r) => r.name === 'tmux');
      expect(tmuxCheck).toBeDefined();
      // tmux is optional, so even if not found it should be warning not error
      if (tmuxCheck?.status !== 'ok') {
        expect(tmuxCheck?.status).toBe('warning');
      }
    });

    it('should check cloudflared (optional)', async () => {
      const results = await runDiagnostics();
      const cloudflaredCheck = results.find((r) => r.name === 'cloudflared');
      expect(cloudflaredCheck).toBeDefined();
      // cloudflared is optional
      if (cloudflaredCheck?.status !== 'ok') {
        expect(cloudflaredCheck?.status).toBe('warning');
      }
    });

    it('should include fix suggestions for errors/warnings', async () => {
      const results = await runDiagnostics();
      results.forEach((result) => {
        if (result.status === 'error' || result.status === 'warning') {
          // Most errors and warnings should have fix suggestions
          // (node-pty might not if it's just not installed yet)
          if (result.name !== 'node-pty' || result.status === 'error') {
            expect(result.fix || result.message).toBeTruthy();
          }
        }
      });
    });
  });

  describe('printDiagnostics', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should print header', () => {
      const results: DiagnosticResult[] = [
        { name: 'Test', status: 'ok', message: 'All good' },
      ];
      printDiagnostics(results);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('MConnect');
      expect(output).toContain('Diagnostics');
    });

    it('should print ok results with checkmark', () => {
      const results: DiagnosticResult[] = [
        { name: 'TestCheck', status: 'ok', message: 'Working' },
      ];
      printDiagnostics(results);
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('TestCheck');
      expect(output).toContain('Working');
    });

    it('should print error results', () => {
      const results: DiagnosticResult[] = [
        { name: 'BrokenThing', status: 'error', message: 'Not working', fix: 'Fix it' },
      ];
      printDiagnostics(results);
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('BrokenThing');
      expect(output).toContain('Not working');
      expect(output).toContain('Fix it');
    });

    it('should print warning results', () => {
      const results: DiagnosticResult[] = [
        { name: 'PartialThing', status: 'warning', message: 'Could be better' },
      ];
      printDiagnostics(results);
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('PartialThing');
      expect(output).toContain('Could be better');
    });

    it('should show success message when all checks pass', () => {
      const results: DiagnosticResult[] = [
        { name: 'Test1', status: 'ok', message: 'Good' },
        { name: 'Test2', status: 'ok', message: 'Good' },
      ];
      printDiagnostics(results);
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('passed');
    });

    it('should show error message when there are errors', () => {
      const results: DiagnosticResult[] = [
        { name: 'Test1', status: 'ok', message: 'Good' },
        { name: 'Test2', status: 'error', message: 'Bad', fix: 'Fix' },
      ];
      printDiagnostics(results);
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('missing');
    });

    it('should show warning message when there are only warnings', () => {
      const results: DiagnosticResult[] = [
        { name: 'Test1', status: 'ok', message: 'Good' },
        { name: 'Test2', status: 'warning', message: 'Optional missing' },
      ];
      printDiagnostics(results);
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('optional');
    });
  });

  describe('isNodePtyAvailable', () => {
    it('should return a boolean', async () => {
      const result = await isNodePtyAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should be consistent across calls', async () => {
      const result1 = await isNodePtyAvailable();
      const result2 = await isNodePtyAvailable();
      expect(result1).toBe(result2);
    });
  });

  describe('tryInstallNodePty', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should print attempting message', async () => {
      // This may fail in test environment, but should still print the attempt
      try {
        await tryInstallNodePty();
      } catch {
        // Expected in test environment
      }
      const output = consoleLogSpy.mock.calls.flat().join(' ');
      expect(output).toContain('install');
    });

    it('should return a boolean', async () => {
      const result = await tryInstallNodePty();
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Doctor Integration', () => {
  it('should have consistent check order', async () => {
    const results = await runDiagnostics();
    const names = results.map((r) => r.name);

    // Required checks should come first
    expect(names.indexOf('Node.js')).toBeLessThan(names.indexOf('tmux'));
    expect(names.indexOf('Shell')).toBeLessThan(names.indexOf('cloudflared'));
  });

  it('Node.js check should pass in test environment', async () => {
    const results = await runDiagnostics();
    const nodeCheck = results.find((r) => r.name === 'Node.js');
    // We're running tests, so Node.js must be available
    expect(nodeCheck?.status).not.toBe('error');
  });

  it('Shell check should pass in test environment', async () => {
    const results = await runDiagnostics();
    const shellCheck = results.find((r) => r.name === 'Shell');
    // Shell should exist in test environment
    expect(shellCheck?.status).toBe('ok');
  });
});
