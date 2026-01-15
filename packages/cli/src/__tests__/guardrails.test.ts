import { describe, it, expect } from 'vitest';
import { loadGuardrails, checkCommand, GuardrailConfig } from '../guardrails.js';

describe('Guardrails Module', () => {
  describe('loadGuardrails', () => {
    it('should load default guardrails', () => {
      const config = loadGuardrails('default');
      expect(config.level).toBe('default');
      expect(config.blockedPatterns.length).toBeGreaterThan(0);
      expect(config.approvalPatterns.length).toBeGreaterThan(0);
    });

    it('should load strict guardrails with more blocked patterns', () => {
      const config = loadGuardrails('strict');
      expect(config.level).toBe('strict');
      expect(config.blockedPatterns.length).toBeGreaterThan(0);
      expect(config.approvalPatterns.length).toBeGreaterThan(0);
    });

    it('should load permissive guardrails with fewer patterns', () => {
      const config = loadGuardrails('permissive');
      expect(config.level).toBe('permissive');
    });

    it('should load none guardrails with no patterns', () => {
      const config = loadGuardrails('none');
      expect(config.level).toBe('none');
      expect(config.blockedPatterns.length).toBe(0);
      expect(config.approvalPatterns.length).toBe(0);
    });

    it('should default to "default" for unknown levels', () => {
      const config = loadGuardrails('unknown');
      expect(config.level).toBe('default');
    });
  });

  describe('checkCommand - Default Guardrails', () => {
    const config = loadGuardrails('default');

    describe('Blocked Commands', () => {
      it('should block rm -rf /', () => {
        const result = checkCommand('rm -rf /', config);
        expect(result.blocked).toBe(true);
        expect(result.requiresApproval).toBe(false);
      });

      it('should block rm -rf ~', () => {
        const result = checkCommand('rm -rf ~', config);
        expect(result.blocked).toBe(true);
      });

      it('should block rm -rf .', () => {
        const result = checkCommand('rm -rf .', config);
        expect(result.blocked).toBe(true);
      });

      it('should block mkfs commands', () => {
        const result = checkCommand('mkfs.ext4 /dev/sda1', config);
        expect(result.blocked).toBe(true);
      });

      it('should block dd if= commands', () => {
        const result = checkCommand('dd if=/dev/zero of=/dev/sda', config);
        expect(result.blocked).toBe(true);
      });

      it('should block fork bombs', () => {
        const result = checkCommand(':(){:|:&};:', config);
        expect(result.blocked).toBe(true);
      });
    });

    describe('Commands Requiring Approval', () => {
      it('should require approval for git push --force', () => {
        const result = checkCommand('git push --force', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
        expect(result.reason).toContain('Force push');
      });

      it('should require approval for git reset --hard', () => {
        const result = checkCommand('git reset --hard HEAD~1', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
        expect(result.reason).toContain('Hard reset');
      });

      it('should require approval for rm -rf with path', () => {
        const result = checkCommand('rm -rf ./node_modules', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
      });

      it('should require approval for npm publish', () => {
        const result = checkCommand('npm publish', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
      });

      it('should require approval for DROP TABLE', () => {
        const result = checkCommand('DROP TABLE users;', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
      });
    });

    describe('Allowed Commands', () => {
      it('should allow ls commands', () => {
        const result = checkCommand('ls -la', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
      });

      it('should allow git status', () => {
        const result = checkCommand('git status', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
      });

      it('should allow npm install', () => {
        const result = checkCommand('npm install lodash', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
      });

      it('should allow normal git push', () => {
        const result = checkCommand('git push origin main', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
      });

      it('should allow mkdir', () => {
        const result = checkCommand('mkdir -p src/components', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
      });

      it('should allow code editors', () => {
        const result = checkCommand('code .', config);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
      });
    });
  });

  describe('checkCommand - Strict Guardrails', () => {
    const config = loadGuardrails('strict');

    it('should require approval for any rm command', () => {
      const result = checkCommand('rm file.txt', config);
      expect(result.requiresApproval).toBe(true);
    });

    it('should require approval for any git push', () => {
      const result = checkCommand('git push origin main', config);
      expect(result.requiresApproval).toBe(true);
    });

    it('should require approval for docker rm', () => {
      const result = checkCommand('docker rm container-id', config);
      expect(result.requiresApproval).toBe(true);
    });

    it('should require approval for kubectl delete', () => {
      const result = checkCommand('kubectl delete pod my-pod', config);
      expect(result.requiresApproval).toBe(true);
    });

    it('should require approval for DELETE FROM', () => {
      const result = checkCommand('DELETE FROM users WHERE id = 1', config);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('checkCommand - None Guardrails', () => {
    const config = loadGuardrails('none');

    it('should allow rm -rf /', () => {
      const result = checkCommand('rm -rf /', config);
      expect(result.blocked).toBe(false);
      expect(result.requiresApproval).toBe(false);
    });

    it('should allow any command', () => {
      const result = checkCommand('mkfs.ext4 /dev/sda1', config);
      expect(result.blocked).toBe(false);
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('checkCommand - Case Insensitivity', () => {
    const config = loadGuardrails('default');

    it('should catch DROP TABLE regardless of case', () => {
      expect(checkCommand('DROP TABLE users', config).requiresApproval).toBe(true);
      expect(checkCommand('drop table users', config).requiresApproval).toBe(true);
      expect(checkCommand('Drop Table users', config).requiresApproval).toBe(true);
    });

    it('should catch rm -rf regardless of case variations', () => {
      expect(checkCommand('RM -RF /', config).blocked).toBe(true);
      expect(checkCommand('rm -RF /', config).blocked).toBe(true);
    });
  });
});
