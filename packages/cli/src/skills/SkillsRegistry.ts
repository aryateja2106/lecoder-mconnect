/**
 * SkillsRegistry
 *
 * Local-first registry for reusable agent skill prompts. Inspired by Paseo's
 * `npx skills add getpaseo/paseo` flow and Multica's reusable skills system.
 *
 * Storage layout:
 *   ~/.lecoder/skills/
 *     <namespace>/
 *       <skill-name>.md          - the skill prompt (with optional YAML frontmatter)
 *
 * A skill is just a Markdown file. Optional YAML frontmatter declares
 * metadata (provider, model, args, description). Agents consume the
 * Markdown body verbatim — no templating engine required.
 *
 * Add sources:
 *   - `lecoder skills add <github-org>/<repo>` clones a repo containing a
 *     `skills/` directory and copies its `*.md` files into
 *     `~/.lecoder/skills/<github-org>-<repo>/`.
 *   - `lecoder skills add ./path/to/local/skill.md` copies a single file.
 *
 * The registry is intentionally simple and read-only at runtime: skills are
 * meant to live on disk where users can edit them in their favorite editor.
 */

import { execFile } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SkillFrontmatter {
  description?: string;
  provider?: string;
  model?: string;
  tags?: string[];
  args?: string[];
}

export interface Skill {
  /** Fully-qualified id, e.g. `getpaseo-paseo/handoff` */
  id: string;
  /** Source namespace. */
  namespace: string;
  /** Bare name without extension. */
  name: string;
  /** Absolute filesystem path. */
  path: string;
  /** Parsed frontmatter (best-effort). */
  frontmatter: SkillFrontmatter;
  /** The body of the markdown file (no frontmatter). */
  body: string;
}

export interface CommandRunner {
  run(command: string, args: string[], opts?: { cwd?: string }): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
}

const realRunner: CommandRunner = {
  async run(command, args, opts) {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { cwd: opts?.cwd });
      return { exitCode: 0, stdout: String(stdout), stderr: String(stderr) };
    } catch (err) {
      const error = err as { code?: number; stdout?: string; stderr?: string };
      return {
        exitCode: typeof error.code === 'number' ? error.code : 1,
        stdout: String(error.stdout ?? ''),
        stderr: String(error.stderr ?? ''),
      };
    }
  },
};

export interface FsLayer {
  exists(path: string): boolean;
  isDir(path: string): boolean;
  isFile(path: string): boolean;
  readDir(path: string): string[];
  readFile(path: string): string;
  writeFile(path: string, contents: string): void;
  mkdir(path: string): void;
  copy(src: string, dest: string): void;
  rm(path: string): void;
}

const realFs: FsLayer = {
  exists: (p) => existsSync(p),
  isDir: (p) => existsSync(p) && statSync(p).isDirectory(),
  isFile: (p) => existsSync(p) && statSync(p).isFile(),
  readDir: (p) => (existsSync(p) ? readdirSync(p) : []),
  readFile: (p) => readFileSync(p, 'utf-8'),
  writeFile: (p, c) => writeFileSync(p, c, 'utf-8'),
  mkdir: (p) => {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  },
  copy: (src, dest) => {
    cpSync(src, dest, { recursive: true });
  },
  rm: (p) => {
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  },
};

export interface SkillsRegistryOptions {
  /** Override the storage root. Defaults to ~/.lecoder/skills. */
  root?: string;
  fs?: FsLayer;
  runner?: CommandRunner;
}

export class SkillsRegistry {
  private readonly root: string;
  private readonly fs: FsLayer;
  private readonly runner: CommandRunner;

  constructor(options: SkillsRegistryOptions = {}) {
    this.root = options.root ?? join(homedir(), '.lecoder', 'skills');
    this.fs = options.fs ?? realFs;
    this.runner = options.runner ?? realRunner;
  }

  getRoot(): string {
    return this.root;
  }

  /**
   * Enumerate all installed skills.
   */
  list(): Skill[] {
    if (!this.fs.isDir(this.root)) return [];

    const result: Skill[] = [];
    for (const namespace of this.fs.readDir(this.root)) {
      const nsDir = join(this.root, namespace);
      if (!this.fs.isDir(nsDir)) continue;
      for (const file of this.fs.readDir(nsDir)) {
        if (!file.endsWith('.md')) continue;
        const skill = this.readSkill(namespace, file);
        if (skill) result.push(skill);
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): Skill | null {
    const slash = id.indexOf('/');
    if (slash <= 0) return null;
    const namespace = id.slice(0, slash);
    const name = id.slice(slash + 1);
    return this.readSkill(namespace, name.endsWith('.md') ? name : `${name}.md`);
  }

  /**
   * Add skills from a GitHub repository (`<org>/<repo>`) or a local path.
   *
   * For GitHub: shallow-clones the repo to a temp directory and copies its
   * `skills/` dir into `~/.lecoder/skills/<org>-<repo>/`. If the repo has
   * no `skills/`, falls back to copying any `*.md` files at the root.
   *
   * For local paths: copies a single file or a directory of `.md` files
   * into `~/.lecoder/skills/local/`.
   */
  async add(source: string): Promise<{ namespace: string; added: string[] }> {
    if (this.looksLikeLocalPath(source)) {
      return this.addLocal(source);
    }
    return this.addGithub(source);
  }

  /** Remove all skills from a namespace. Returns true when something was removed. */
  remove(namespace: string): boolean {
    const dir = join(this.root, namespace);
    if (!this.fs.isDir(dir)) return false;
    this.fs.rm(dir);
    return true;
  }

  // ---- internals ----

  private readSkill(namespace: string, fileName: string): Skill | null {
    const path = join(this.root, namespace, fileName);
    if (!this.fs.isFile(path)) return null;
    const raw = this.fs.readFile(path);
    const { frontmatter, body } = parseFrontmatter(raw);
    const name = fileName.replace(/\.md$/, '');
    return {
      id: `${namespace}/${name}`,
      namespace,
      name,
      path,
      frontmatter,
      body,
    };
  }

  private addLocal(source: string): { namespace: string; added: string[] } {
    const abs = resolve(source);
    if (!this.fs.exists(abs)) {
      throw new Error(`Path does not exist: ${abs}`);
    }
    const namespace = 'local';
    const dest = join(this.root, namespace);
    this.fs.mkdir(dest);

    const added: string[] = [];
    if (this.fs.isFile(abs)) {
      if (!abs.endsWith('.md')) {
        throw new Error('Only .md files are supported');
      }
      const target = join(dest, basename(abs));
      this.fs.copy(abs, target);
      added.push(`${namespace}/${basename(abs).replace(/\.md$/, '')}`);
      return { namespace, added };
    }

    if (this.fs.isDir(abs)) {
      for (const file of this.fs.readDir(abs)) {
        if (!file.endsWith('.md')) continue;
        const target = join(dest, file);
        this.fs.copy(join(abs, file), target);
        added.push(`${namespace}/${file.replace(/\.md$/, '')}`);
      }
      return { namespace, added };
    }

    throw new Error(`Unsupported source: ${abs}`);
  }

  private async addGithub(source: string): Promise<{ namespace: string; added: string[] }> {
    if (!/^[\w.-]+\/[\w.-]+$/.test(source)) {
      throw new Error(
        `Unrecognized skill source "${source}". Use "<org>/<repo>" or a local path.`
      );
    }
    const namespace = source.replace('/', '-').toLowerCase();
    const dest = join(this.root, namespace);
    this.fs.mkdir(this.root);

    // Use a temp dir under root so cleanup is local to the registry.
    const tmpDir = join(this.root, `.tmp-${namespace}-${Date.now()}`);
    if (this.fs.exists(tmpDir)) this.fs.rm(tmpDir);
    this.fs.mkdir(tmpDir);

    try {
      const url = `https://github.com/${source}.git`;
      const result = await this.runner.run('git', ['clone', '--depth', '1', url, tmpDir]);
      if (result.exitCode !== 0) {
        throw new Error(`git clone failed: ${result.stderr.trim() || result.stdout.trim()}`);
      }

      const skillsDir = join(tmpDir, 'skills');
      const sourceDir = this.fs.isDir(skillsDir) ? skillsDir : tmpDir;
      this.fs.rm(dest);
      this.fs.mkdir(dest);

      const added: string[] = [];
      for (const file of this.fs.readDir(sourceDir)) {
        if (!file.endsWith('.md')) continue;
        // Skip readme/license noise.
        const lower = file.toLowerCase();
        if (lower === 'readme.md' || lower === 'license.md') continue;
        const src = join(sourceDir, file);
        if (!this.fs.isFile(src)) continue;
        const target = join(dest, file);
        this.fs.copy(src, target);
        added.push(`${namespace}/${file.replace(/\.md$/, '')}`);
      }
      return { namespace, added };
    } finally {
      this.fs.rm(tmpDir);
    }
  }

  private looksLikeLocalPath(source: string): boolean {
    return source.startsWith('./') || source.startsWith('../') || source.startsWith('/');
  }
}

/**
 * Parse YAML-like frontmatter from a markdown file.
 *
 * We don't pull in a YAML dependency; this is a tolerant parser that handles
 * the small subset users typically write: scalars, comma-separated lists,
 * and array-bracket notation.
 */
export function parseFrontmatter(input: string): { frontmatter: SkillFrontmatter; body: string } {
  if (!input.startsWith('---')) {
    return { frontmatter: {}, body: input };
  }
  const close = input.indexOf('\n---', 3);
  if (close === -1) {
    return { frontmatter: {}, body: input };
  }
  const head = input.slice(3, close).trim();
  const body = input.slice(close + 4).replace(/^\s*\n/, '');

  const result: SkillFrontmatter = {};
  for (const rawLine of head.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!value) continue;
    if (key === 'description') result.description = value;
    else if (key === 'provider') result.provider = value;
    else if (key === 'model') result.model = value;
    else if (key === 'tags' || key === 'args') {
      const list = value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      if (key === 'tags') result.tags = list;
      else result.args = list;
    }
  }
  return { frontmatter: result, body };
}
