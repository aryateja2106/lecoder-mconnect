import { describe, expect, it } from 'vitest';
import { getWebClientHTML } from '../web/web-client.js';

describe('Web Client Module', () => {
  describe('getWebClientHTML', () => {
    it('should return valid HTML with token embedded', () => {
      const html = getWebClientHTML('test-token-123', 'abc12345', true);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('test-token-123');
      expect(html).toContain('abc12345');
    });

    it('should include xterm.js CDN links', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('xterm');
      expect(html).toContain('xterm-addon-fit');
    });

    it('should include MConnect branding', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('MConnect');
      expect(html).toContain('<title>MConnect</title>');
    });

    it('should include control buttons', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('control-bar');
      expect(html).toContain('modeToggle');
    });

    it('should include WebSocket connection code', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('WebSocket');
      expect(html).toContain("type: 'input'");
      expect(html).toContain("'output'");
    });

    it('should set isReadOnly based on parameter', () => {
      const htmlReadOnly = getWebClientHTML('token', 'session', true);
      const htmlEditable = getWebClientHTML('token', 'session', false);

      expect(htmlReadOnly).toContain('let isReadOnly = true');
      expect(htmlEditable).toContain('let isReadOnly = false');
    });

    it('should include agent management features', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('switch_agent');
      expect(html).toContain('kill_agent');
      expect(html).toContain('create_agent');
    });

    it('should include reconnection logic', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('reconnectAttempts');
      expect(html).toContain('maxReconnectAttempts');
    });

    it('should include keepalive ping', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain("type: 'ping'");
    });

    it('should have responsive meta viewport tag', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('viewport');
      expect(html).toContain('width=device-width');
      expect(html).toContain('user-scalable=no');
    });

    it('should include input bar with text field', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('input-field');
      expect(html).toContain('inputField');
      expect(html).toContain('type command');
    });

    it('should include shortcut bar with terminal keys', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('shortcut-bar');
      expect(html).toContain('Ctrl');
      expect(html).toContain('Tab');
      expect(html).toContain('Esc');
      expect(html).toContain('^C');
      expect(html).toContain('^D');
    });

    it('should include arrow key shortcuts', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('ArrowUp');
      expect(html).toContain('ArrowDown');
      expect(html).toContain('ArrowLeft');
      expect(html).toContain('ArrowRight');
    });

    it('should include Ctrl key combinations', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('sendCtrlKey');
      expect(html).toContain('^C'); // Interrupt
      expect(html).toContain('^D'); // EOF
      expect(html).toContain('^L'); // Clear screen
    });

    it('should include readonly hint', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('readonly-hint');
      expect(html).toContain('Enable input mode');
    });

    it('should include Send button', () => {
      const html = getWebClientHTML('token', 'session', true);

      expect(html).toContain('send-btn');
      expect(html).toContain('Send');
    });
  });
});
