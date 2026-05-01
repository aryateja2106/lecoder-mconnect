/**
 * `lecoder skills` — manage local skill prompts.
 *
 *   lecoder skills ls                       list installed skills
 *   lecoder skills view <skill-id>          print body
 *   lecoder skills add <github-org>/<repo>  install from a GitHub repo
 *   lecoder skills add ./path/to/skill.md   install from local path
 *   lecoder skills remove <namespace>       remove a namespace
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { SkillsRegistry } from '../../skills/SkillsRegistry.js';

function getRegistry(): SkillsRegistry {
  return new SkillsRegistry();
}

async function lsCmd(opts: { json?: boolean }): Promise<void> {
  const skills = getRegistry().list();
  if (opts.json) {
    console.log(
      JSON.stringify(
        skills.map((s) => ({ id: s.id, frontmatter: s.frontmatter, path: s.path })),
        null,
        2
      )
    );
    return;
  }
  if (skills.length === 0) {
    console.log(chalk.yellow('\n  No skills installed.'));
    console.log(chalk.dim('  Add one with `lecoder skills add <org>/<repo>`.\n'));
    return;
  }
  console.log(`\n${chalk.bold('Installed skills:')}\n`);
  for (const s of skills) {
    console.log(`  ${chalk.cyan(s.id)}`);
    if (s.frontmatter.description) {
      console.log(`    ${chalk.dim(s.frontmatter.description)}`);
    }
    const meta: string[] = [];
    if (s.frontmatter.provider) meta.push(`provider: ${s.frontmatter.provider}`);
    if (s.frontmatter.tags?.length) meta.push(`tags: ${s.frontmatter.tags.join(', ')}`);
    if (meta.length) console.log(`    ${chalk.dim(meta.join('  '))}`);
  }
  console.log('');
}

async function viewCmd(skillId: string): Promise<void> {
  const skill = getRegistry().get(skillId);
  if (!skill) {
    console.error(chalk.red(`  Skill not found: ${skillId}`));
    process.exit(1);
  }
  console.log('');
  console.log(`  ${chalk.bold(skill.id)}`);
  if (skill.frontmatter.description) {
    console.log(`  ${chalk.dim(skill.frontmatter.description)}`);
  }
  console.log(`  ${chalk.dim(skill.path)}`);
  console.log('');
  console.log(skill.body.trim());
  console.log('');
}

async function addCmd(source: string): Promise<void> {
  const result = await getRegistry().add(source);
  console.log('');
  console.log(`  ${chalk.green('✓')} added ${chalk.bold(result.added.length)} skills under ${chalk.cyan(result.namespace)}`);
  for (const id of result.added) {
    console.log(`    ${chalk.dim(id)}`);
  }
  console.log('');
}

async function removeCmd(namespace: string): Promise<void> {
  const removed = getRegistry().remove(namespace);
  if (removed) {
    console.log(`\n  ${chalk.green('✓')} removed namespace ${chalk.bold(namespace)}\n`);
  } else {
    console.log(`\n  ${chalk.yellow('Nothing to remove')} for namespace ${namespace}\n`);
  }
}

export function createSkillsCommand(): Command {
  const cmd = new Command('skills').description('Manage reusable agent skill prompts').addHelpText(
    'after',
    `
Examples:
  $ lecoder skills add getpaseo/paseo
  $ lecoder skills add ./my-skill.md
  $ lecoder skills ls
  $ lecoder skills view getpaseo-paseo/handoff

Skills live under ~/.lecoder/skills and are plain Markdown files
with optional YAML frontmatter (description, provider, tags, args).`
  );

  cmd
    .command('ls')
    .alias('list')
    .description('List installed skills')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        await lsCmd(opts);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('view <skillId>')
    .description('Show the contents of a skill')
    .action(async (skillId) => {
      try {
        await viewCmd(skillId);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('add <source>')
    .description('Install skills from a GitHub repo or local path')
    .action(async (source) => {
      try {
        await addCmd(source);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  cmd
    .command('remove <namespace>')
    .alias('rm')
    .description('Remove all skills from a namespace')
    .action(async (namespace) => {
      try {
        await removeCmd(namespace);
      } catch (err) {
        console.error(chalk.red(`  ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  return cmd;
}

export default createSkillsCommand;
