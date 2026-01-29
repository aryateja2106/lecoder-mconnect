/**
 * TerminalBridge Unit Tests
 * MConnect v1.1.0 - Sidecar Mode
 *
 * Tests for the terminal I/O bridge that connects
 * the current terminal to WebSocket clients.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock the TerminalBridge class for TDD
// We'll implement this class after tests are written
interface TerminalBridge extends EventEmitter {
  attach(): Promise<boolean>;
  detach(): void;
  write(data: Buffer): void;
  isAttached: boolean;
  size: { rows: number; cols: number };
}

// We'll import the real implementation once it exists
// import { TerminalBridge } from '../sidecar/terminal-bridge.js';

// Mock implementation for TDD
class MockTerminalBridge extends EventEmitter implements TerminalBridge {
  private _isAttached = false;
  private _size = { rows: 24, cols: 80 };
  private _writeBuffer: Buffer[] = [];

  async attach(): Promise<boolean> {
    if (this._isAttached) return false;
    this._isAttached = true;
    return true;
  }

  detach(): void {
    if (this._isAttached) {
      this._isAttached = false;
      this.emit('close');
    }
  }

  write(data: Buffer): void {
    if (this._isAttached) {
      this._writeBuffer.push(data);
    }
  }

  get isAttached(): boolean {
    return this._isAttached;
  }

  get size(): { rows: number; cols: number } {
    return this._size;
  }

  // Test helpers
  simulateOutput(data: string): void {
    this.emit('data', Buffer.from(data));
  }

  simulateResize(rows: number, cols: number): void {
    this._size = { rows, cols };
    this.emit('resize', this._size);
  }

  getWrittenData(): Buffer[] {
    return this._writeBuffer;
  }
}

describe('TerminalBridge', () => {
  let bridge: MockTerminalBridge;

  beforeEach(() => {
    bridge = new MockTerminalBridge();
  });

  afterEach(() => {
    bridge.detach();
    bridge.removeAllListeners();
  });

  describe('attach()', () => {
    it('should attach to terminal and return true', async () => {
      const result = await bridge.attach();
      expect(result).toBe(true);
      expect(bridge.isAttached).toBe(true);
    });

    it('should return false if already attached', async () => {
      await bridge.attach();
      const result = await bridge.attach();
      expect(result).toBe(false);
    });

    it('should emit no events on successful attach', async () => {
      const dataHandler = vi.fn();
      bridge.on('data', dataHandler);

      await bridge.attach();

      expect(dataHandler).not.toHaveBeenCalled();
    });
  });

  describe('detach()', () => {
    it('should detach from terminal', async () => {
      await bridge.attach();
      bridge.detach();
      expect(bridge.isAttached).toBe(false);
    });

    it('should emit close event on detach', async () => {
      const closeHandler = vi.fn();
      bridge.on('close', closeHandler);

      await bridge.attach();
      bridge.detach();

      expect(closeHandler).toHaveBeenCalledTimes(1);
    });

    it('should not emit close if not attached', () => {
      const closeHandler = vi.fn();
      bridge.on('close', closeHandler);

      bridge.detach();

      expect(closeHandler).not.toHaveBeenCalled();
    });
  });

  describe('write()', () => {
    it('should accept input when attached', async () => {
      await bridge.attach();
      const data = Buffer.from('test input');

      bridge.write(data);

      expect(bridge.getWrittenData()).toHaveLength(1);
      expect(bridge.getWrittenData()[0].toString()).toBe('test input');
    });

    it('should ignore input when not attached', () => {
      const data = Buffer.from('test input');

      bridge.write(data);

      expect(bridge.getWrittenData()).toHaveLength(0);
    });

    it('should handle binary data', async () => {
      await bridge.attach();
      const binaryData = Buffer.from([0x1b, 0x5b, 0x41]); // Escape sequence

      bridge.write(binaryData);

      expect(bridge.getWrittenData()[0]).toEqual(binaryData);
    });
  });

  describe('data event', () => {
    it('should emit data event for terminal output', async () => {
      const dataHandler = vi.fn();
      bridge.on('data', dataHandler);

      await bridge.attach();
      bridge.simulateOutput('Hello World');

      expect(dataHandler).toHaveBeenCalledTimes(1);
      expect(dataHandler).toHaveBeenCalledWith(Buffer.from('Hello World'));
    });

    it('should emit multiple data events', async () => {
      const dataHandler = vi.fn();
      bridge.on('data', dataHandler);

      await bridge.attach();
      bridge.simulateOutput('Line 1\n');
      bridge.simulateOutput('Line 2\n');
      bridge.simulateOutput('Line 3\n');

      expect(dataHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('resize event', () => {
    it('should emit resize event when terminal size changes', async () => {
      const resizeHandler = vi.fn();
      bridge.on('resize', resizeHandler);

      await bridge.attach();
      bridge.simulateResize(30, 120);

      expect(resizeHandler).toHaveBeenCalledWith({ rows: 30, cols: 120 });
    });

    it('should update size property on resize', async () => {
      await bridge.attach();
      bridge.simulateResize(40, 160);

      expect(bridge.size).toEqual({ rows: 40, cols: 160 });
    });
  });

  describe('size property', () => {
    it('should return default size before attach', () => {
      expect(bridge.size).toEqual({ rows: 24, cols: 80 });
    });

    it('should return current terminal size after attach', async () => {
      await bridge.attach();
      // Default size should be maintained
      expect(bridge.size.rows).toBeGreaterThan(0);
      expect(bridge.size.cols).toBeGreaterThan(0);
    });
  });

  describe('isAttached property', () => {
    it('should be false initially', () => {
      expect(bridge.isAttached).toBe(false);
    });

    it('should be true after attach', async () => {
      await bridge.attach();
      expect(bridge.isAttached).toBe(true);
    });

    it('should be false after detach', async () => {
      await bridge.attach();
      bridge.detach();
      expect(bridge.isAttached).toBe(false);
    });
  });
});

describe('TerminalBridge Edge Cases', () => {
  let bridge: MockTerminalBridge;

  beforeEach(() => {
    bridge = new MockTerminalBridge();
  });

  afterEach(() => {
    bridge.detach();
    bridge.removeAllListeners();
  });

  it('should handle rapid attach/detach cycles', async () => {
    for (let i = 0; i < 10; i++) {
      await bridge.attach();
      bridge.detach();
    }
    expect(bridge.isAttached).toBe(false);
  });

  it('should handle large data chunks', async () => {
    const dataHandler = vi.fn();
    bridge.on('data', dataHandler);

    await bridge.attach();
    const largeData = 'x'.repeat(100000);
    bridge.simulateOutput(largeData);

    expect(dataHandler).toHaveBeenCalled();
    const receivedData = dataHandler.mock.calls[0][0] as Buffer;
    expect(receivedData.length).toBe(100000);
  });

  it('should handle empty data', async () => {
    const dataHandler = vi.fn();
    bridge.on('data', dataHandler);

    await bridge.attach();
    bridge.simulateOutput('');

    expect(dataHandler).toHaveBeenCalledWith(Buffer.from(''));
  });

  it('should handle unicode data', async () => {
    const dataHandler = vi.fn();
    bridge.on('data', dataHandler);

    await bridge.attach();
    const unicodeData = '你好世界 🌍 مرحبا';
    bridge.simulateOutput(unicodeData);

    const receivedData = dataHandler.mock.calls[0][0] as Buffer;
    expect(receivedData.toString()).toBe(unicodeData);
  });
});
