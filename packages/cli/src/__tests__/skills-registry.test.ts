/**
 * Tests for skills/SkillsRegistry
 */

import { describe, expect, it } from 'vitest';
import {
  type CommandRunner,
  type FsLayer,
  parseFrontmatter,
  SkillsRegistry,
} from '../skills/SkillsRegistry.js';

function makeFs() {
  const files = new Map<string, string>();
  const dirs = new Set<string>();

  function ensureParents(path: string): void {
    let i = path.lastIndexOf('/');
    while (i > 0) {
      dirs.add(path.slice(0, i));
      i = path.lastIndexOf('/', i - 1);
    }
  }

  const fs: FsLayer = {
    exists: (p) => files.has(p) || dirs.has(p),
    isDir: (p) => dirs.has(p),
    isFile: (p) => files.has(p),
    readDir: (p) => {
      if (!dirs.has(p)) return [];
      const prefix = `${p}/`;
      const seen = new Set<string>();
      for (const name of [...files.keys(), ...dirs]) {
        if (!name.startsWith(prefix)) continue;
        const tail = name.slice(prefix.length);
        const next = tail.split('/')[0];
        if (next) seen.add(next);
      }
      return [...seen];
    },
    readFile: (p) => {
      const c = files.get(p);
      if (c === undefined) throw new Error(`ENOENT: ${p}`);
      return c;
    },
    writeFile: (p, c) => {
      files.set(p, c);
      ensureParents(p);
    },
    mkdir: (p) => {
      dirs.add(p);
      ensureParents(p);
    },
    copy: (src, dest) => {
      // Single file
      if (files.has(src)) {
        files.set(dest, files.get(src)!);
        ensureParents(dest);
        return;
      }
      // Directory copy: copy every file under src/ to dest/.
      if (dirs.has(src)) {
        dirs.add(dest);
        const prefix = `${src}/`;
        for (const [name, content] of files.entries()) {
          if (name.startsWith(prefix)) {
            const target = `${dest}/${name.slice(prefix.length)}`;
            files.set(target, content);
            ensureParents(target);
          }
        }
      }
    },
    rm: (p) => {
      for (const name of [...files.keys()]) {
        if (name === p || name.startsWith(`${p}/`)) files.delete(name);
      }
      for (const name of [...dirs]) {
        if (name === p || name.startsWith(`${p}/`)) dirs.delete(name);
      }
    },
  };
  return { fs, files, dirs };
}

describe('parseFrontmatter', () => {
  it('returns empty when no frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('# Hello\n\nWorld');
    expect(frontmatter).toEqual({});
    expect(body).toBe('# Hello\n\nWorld');
  });

  it('parses scalar fields', () => {
    const { frontmatter, body } = parseFrontmatter(
      '---\ndescription: A skill\nprovider: claude\n---\n# Body\n'
    );
    expect(frontmatter.description).toBe('A skill');
    expect(frontmatter.provider).toBe('claude');
    expect(body.trim()).toBe('# Body');
  });

  it('parses list fields with both syntaxes', () => {
    const a = parseFrontmatter('---\ntags: foo, bar\nargs: [a, b, c]\n---\nbody\n');
    expect(a.frontmatter.tags).toEqual(['foo', 'bar']);
    expect(a.frontmatter.args).toEqual(['a', 'b', 'c']);
  });

  it('strips quotes from string values', () => {
    const a = parseFrontmatter('---\ndescription: "quoted"\n---\nx\n');
    expect(a.frontmatter.description).toBe('quoted');
  });
});

describe('SkillsRegistry', () => {
  it('lists installed skills', () => {
    const { fs } = makeFs();
    const registry = new SkillsRegistry({ root: '/skills', fs });
    fs.mkdir('/skills/getpaseo-paseo');
    fs.writeFile(
      '/skills/getpaseo-paseo/handoff.md',
      '---\ndescription: Hand off\n---\nuse paseo\n'
    );
    fs.writeFile(
      '/skills/getpaseo-paseo/loop.md',
      '---\ndescription: Loop\n---\nrun a loop\n'
    );

    const list = registry.list();
    expect(list.length).toBe(2);
    expect(list.map((s) => s.id)).toEqual([
      'getpaseo-paseo/handoff',
      'getpaseo-paseo/loop',
    ]);
    expect(list[0].frontmatter.description).toBe('Hand off');
  });

  it('returns null for unknown skill ids', () => {
    const { fs } = makeFs();
    const registry = new SkillsRegistry({ root: '/skills', fs });
    expect(registry.get('unknown/skill')).toBeNull();
    expect(registry.get('bare')).toBeNull();
  });

  it('add() rejects unrecognized sources', async () => {
    const { fs } = makeFs();
    const runner: CommandRunner = {
      async run() {
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const registry = new SkillsRegistry({ root: '/skills', fs, runner });
    await expect(registry.add('not a thing')).rejects.toThrow();
  });

  it('add(github) shallow-clones and copies skill files', async () => {
    const { fs } = makeFs();
    fs.mkdir('/skills');
    const calls: string[][] = [];
    const runner: CommandRunner = {
      async run(_command, args) {
        calls.push(args);
        // Simulate git clone — populate the temp dir (last arg).
        const tmp = args[args.length - 1];
        fs.mkdir(`${tmp}/skills`);
        fs.writeFile(`${tmp}/skills/handoff.md`, 'use paseo');
        fs.writeFile(`${tmp}/skills/loop.md`, 'run a loop');
        fs.writeFile(`${tmp}/README.md`, 'noise'); // should be skipped
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const registry = new SkillsRegistry({ root: '/skills', fs, runner });
    const result = await registry.add('getpaseo/paseo');
    expect(result.namespace).toBe('getpaseo-paseo');
    expect(result.added.sort()).toEqual([
      'getpaseo-paseo/handoff',
      'getpaseo-paseo/loop',
    ]);
    expect(calls[0].slice(0, 3)).toEqual(['clone', '--depth', '1']);
  });

  it('add(github) falls back to repo root when no skills/ dir', async () => {
    const { fs } = makeFs();
    fs.mkdir('/skills');
    const runner: CommandRunner = {
      async run(_command, args) {
        const tmp = args[args.length - 1];
        fs.writeFile(`${tmp}/quick.md`, 'do the thing');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const registry = new SkillsRegistry({ root: '/skills', fs, runner });
    const result = await registry.add('foo/bar');
    expect(result.added).toContain('foo-bar/quick');
  });

  it('add(github) surfaces clone failures', async () => {
    const { fs } = makeFs();
    const runner: CommandRunner = {
      async run() {
        return { exitCode: 1, stdout: '', stderr: 'fatal' };
      },
    };
    const registry = new SkillsRegistry({ root: '/skills', fs, runner });
    await expect(registry.add('a/b')).rejects.toThrow(/git clone/);
  });

  it('add(local file) installs under the local namespace', async () => {
    const { fs } = makeFs();
    fs.writeFile('/abs/my-skill.md', '---\ndescription: x\n---\nbody\n');
    const runner: CommandRunner = { async run() { return { exitCode: 0, stdout: '', stderr: '' }; } };
    const registry = new SkillsRegistry({ root: '/skills', fs, runner });
    const result = await registry.add('/abs/my-skill.md');
    expect(result.namespace).toBe('local');
    expect(result.added).toEqual(['local/my-skill']);
    const skill = registry.get('local/my-skill');
    expect(skill?.frontmatter.description).toBe('x');
  });

  it('remove() drops a namespace', () => {
    const { fs } = makeFs();
    fs.mkdir('/skills/foo');
    fs.writeFile('/skills/foo/x.md', 'a');
    const registry = new SkillsRegistry({ root: '/skills', fs });
    expect(registry.remove('foo')).toBe(true);
    expect(registry.list()).toEqual([]);
    expect(registry.remove('foo')).toBe(false);
  });
});
