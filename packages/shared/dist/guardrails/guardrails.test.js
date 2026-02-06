/**
 * Tests for guardrails module
 */
import { describe, test, expect } from 'bun:test';
import { loadGuardrails, checkCommand, filterCommand, getGuardrailDescription, isGuardrailsDisabled, } from './index.js';
describe('loadGuardrails', () => {
    test('returns default config for "default" level', () => {
        const config = loadGuardrails('default');
        expect(config.level).toBe('default');
        expect(config.blockedPatterns.length).toBeGreaterThan(0);
        expect(config.approvalPatterns.length).toBeGreaterThan(0);
    });
    test('returns strict config for "strict" level', () => {
        const config = loadGuardrails('strict');
        expect(config.level).toBe('strict');
        expect(config.approvalPatterns.length).toBeGreaterThan(loadGuardrails('default').approvalPatterns.length);
    });
    test('returns permissive config for "permissive" level', () => {
        const config = loadGuardrails('permissive');
        expect(config.level).toBe('permissive');
        expect(config.approvalPatterns.length).toBeLessThan(loadGuardrails('default').approvalPatterns.length);
    });
    test('returns empty patterns for "none" level', () => {
        const config = loadGuardrails('none');
        expect(config.level).toBe('none');
        expect(config.blockedPatterns.length).toBe(0);
        expect(config.approvalPatterns.length).toBe(0);
    });
    test('defaults to "default" for unknown level', () => {
        const config = loadGuardrails('unknown');
        expect(config.level).toBe('default');
    });
});
describe('checkCommand', () => {
    const defaultConfig = loadGuardrails('default');
    test('blocks rm -rf /', () => {
        const result = checkCommand('rm -rf /', defaultConfig);
        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('blocked');
    });
    test('blocks rm -rf ~', () => {
        const result = checkCommand('rm -rf ~', defaultConfig);
        expect(result.blocked).toBe(true);
    });
    test('blocks fork bomb', () => {
        const result = checkCommand(':(){:|:&};:', defaultConfig);
        expect(result.blocked).toBe(true);
    });
    test('blocks mkfs', () => {
        const result = checkCommand('mkfs -t ext4 /dev/sda1', defaultConfig);
        expect(result.blocked).toBe(true);
    });
    test('requires approval for rm -rf (non-root)', () => {
        const result = checkCommand('rm -rf ./node_modules', defaultConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
    });
    test('requires approval for git push --force', () => {
        const result = checkCommand('git push --force origin main', defaultConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
    });
    test('requires approval for npm publish', () => {
        const result = checkCommand('npm publish', defaultConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
    });
    test('allows normal commands', () => {
        const result = checkCommand('ls -la', defaultConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
    });
    test('allows git push (non-force) on default', () => {
        const result = checkCommand('git push origin main', defaultConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
    });
    test('strict level requires approval for git push', () => {
        const strictConfig = loadGuardrails('strict');
        const result = checkCommand('git push origin main', strictConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(true);
    });
    test('none level allows everything', () => {
        const noneConfig = loadGuardrails('none');
        const result = checkCommand('rm -rf /', noneConfig);
        expect(result.blocked).toBe(false);
        expect(result.requiresApproval).toBe(false);
    });
});
describe('filterCommand', () => {
    const config = loadGuardrails('default');
    test('returns allowed:false for blocked commands', () => {
        const result = filterCommand('rm -rf /', config);
        expect(result.allowed).toBe(false);
        expect(result.command).toBeNull();
    });
    test('returns allowed:true for normal commands', () => {
        const result = filterCommand('ls -la', config);
        expect(result.allowed).toBe(true);
        expect(result.command).toBe('ls -la');
    });
    test('returns allowed:true with requiresApproval for approval commands', () => {
        const result = filterCommand('npm publish', config);
        expect(result.allowed).toBe(true);
        expect(result.command).toBe('npm publish');
        expect(result.check.requiresApproval).toBe(true);
    });
});
describe('utility functions', () => {
    test('isGuardrailsDisabled returns true for none', () => {
        expect(isGuardrailsDisabled('none')).toBe(true);
        expect(isGuardrailsDisabled('default')).toBe(false);
    });
    test('getGuardrailDescription returns description for each level', () => {
        expect(getGuardrailDescription('none')).toContain('development');
        expect(getGuardrailDescription('permissive')).toContain('Minimal');
        expect(getGuardrailDescription('default')).toContain('Standard');
        expect(getGuardrailDescription('strict')).toContain('Strict');
    });
});
//# sourceMappingURL=guardrails.test.js.map