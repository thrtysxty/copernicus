import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { app } from 'electron';
import { GenesisPayload, SynthesisResult } from './types';
import { assertSafePath } from '../utils/path-guard';
import log from '../utils/logger';

export class ScaffoldRunner {
  public scaffold(params: { title: string, priority: string }): string {
    const { storiesManager } = require('../main')
    if (storiesManager) {
      return storiesManager.createStory({ title: params.title, priority: params.priority, type: 'Feature', epic: '(none)' })
    }
    return ''
  }

  public async checkHarness(repoPath: string): Promise<boolean> {
    try {
      assertSafePath(repoPath);
    } catch (err: any) {
      log.error(`[ScaffoldRunner] Path safety check failed: ${err.message}`);
      return false;
    }

    const hasDocsStories = fs.existsSync(path.join(repoPath, 'docs', 'stories'));
    const hasClaudeMd = fs.existsSync(path.join(repoPath, 'CLAUDE.md'));

    return hasDocsStories && hasClaudeMd;
  }

  public async scaffoldHarness(repoPath: string): Promise<void> {
    try {
      assertSafePath(repoPath);
    } catch (err: any) {
      log.error(`[ScaffoldRunner] Path safety check failed: ${err.message}`);
      return;
    }

    try {
      // 1. Ensure docs/stories structure
      this.ensureDocsStructure(repoPath);

      // 2. Ensure docs/reference structure
      const referencePath = path.join(repoPath, 'docs', 'reference');
      if (!fs.existsSync(referencePath)) {
        fs.mkdirSync(referencePath, { recursive: true });
      }

      // 3. Ensure CLAUDE.md (minimal template)
      const projectName = path.basename(repoPath);
      const claudePath = path.join(repoPath, 'CLAUDE.md');
      if (!fs.existsSync(claudePath)) {
        const claudeContent = `# CLAUDE.md
**Project:** ${projectName}

## Role Boundaries — ENFORCED
Claude's role is Plan → Delegate → Review. Not implement.

## Architecture
- Defined as project develops
`;
        fs.writeFileSync(claudePath, claudeContent);
      }

      // 4. Ensure AGENTS.md (minimal template)
      const agentsPath = path.join(repoPath, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) {
        const agentsContent = `# AGENTS.md — ${projectName}

## Role Boundaries
- Plan → Delegate → Review
- Do not implement inline when a story can be dispatched

## Key Constraints
- Follow IPC error handling standard (handleIpc + useIpcError + unwrapIpc)
- No secrets in committed files
- Run tsc --noEmit before marking story complete

## Stories
Stories are in \`docs/stories/\`. Completed stories move to \`docs/stories/completed/\`.
`;
        fs.writeFileSync(agentsPath, agentsContent);
      }

      log.info(`[ScaffoldRunner] Harness scaffold complete for ${projectName} at ${repoPath}`);
    } catch (err: any) {
      log.error(`[ScaffoldRunner] scaffoldHarness failed: ${err.message}`);
    }
  }

  public async run(payload: GenesisPayload, _synthesisResult: SynthesisResult): Promise<void> {
    const { repoPath, projectName, isNewRepo } = payload;
    
    try {
      assertSafePath(repoPath);
    } catch (err: any) {
      log.error(`[ScaffoldRunner] Path safety check failed: ${err.message}`);
      return; // Stop if path is unsafe
    }

    try {
      if (isNewRepo) {
        this.scaffoldNewRepo(payload);
      } else {
        this.scaffoldExistingRepo();
      }

      this.writeAgentConfig(payload);
      this.ensureDocsStructure(repoPath);

      if (isNewRepo) {
        this.firstCommit(repoPath, projectName);
      }

      log.info(`[ScaffoldRunner] Scaffold complete for ${projectName} at ${repoPath}`);
    } catch (err: any) {
      log.error(`[ScaffoldRunner] scaffold failed: ${err.message}`);
      // Do not throw, as per Story 288 AC Error handling
    }
  }

  private scaffoldNewRepo(payload: GenesisPayload): void {
    const { repoPath, projectName, idea, stack } = payload;

    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
    }

    try {
      const res = spawnSync('git', ['init'], { cwd: repoPath });
      if (res.error) throw res.error;
      if (res.status !== 0) throw new Error(`git init exited with ${res.status}`);
    } catch (err: any) {
      log.warn(`[ScaffoldRunner] git init failed: ${err.message}`);
    }

    const structure = this.getStackStructure(stack);
    for (const dir of structure) {
      fs.mkdirSync(path.join(repoPath, dir), { recursive: true });
    }

    const gitignore = this.getGitignore(stack);
    fs.writeFileSync(path.join(repoPath, '.gitignore'), gitignore);

    const readme = `# ${projectName}\n\n${idea}`;
    fs.writeFileSync(path.join(repoPath, 'README.md'), readme);
  }

  private scaffoldExistingRepo(): void {
    // For existing repos, we only ensure AGENTS.md and CLAUDE.md exist (handled in writeAgentConfig)
    // and docs structure (handled in ensureDocsStructure)
  }

  private writeAgentConfig(payload: GenesisPayload): void {
    const { repoPath, projectName, idea, audience, coreValue, stack, isNewRepo } = payload;

    const templatesDir = path.join(app.getAppPath(), 'electron', 'genesis', 'templates');

    const commonDir = path.join(templatesDir, 'common');
    const stackDir = path.join(templatesDir, stack);

    // Default fallbacks in case templates are somehow missing
    let agentsContent = '';
    let claudeContent = '';

    try {
      const agentsTemplatePath = path.join(commonDir, 'AGENTS.md');
      if (fs.existsSync(agentsTemplatePath)) {
        let tpl = fs.readFileSync(agentsTemplatePath, 'utf8');
        tpl = tpl.replace(/\{\{projectName\}\}/g, projectName);
        tpl = tpl.replace(/\{\{idea\}\}/g, idea);
        tpl = tpl.replace(/\{\{audience\}\}/g, audience);
        tpl = tpl.replace(/\{\{coreValue\}\}/g, coreValue);
        tpl = tpl.replace(/\{\{stack\}\}/g, stack);
        agentsContent = tpl;
      } else {
        log.warn(`[ScaffoldRunner] Missing AGENTS.md template at ${agentsTemplatePath}`);
      }

      const claudeTemplatePath = path.join(commonDir, 'CLAUDE.md');
      if (fs.existsSync(claudeTemplatePath)) {
        let tpl = fs.readFileSync(claudeTemplatePath, 'utf8');
        tpl = tpl.replace(/\{\{projectName\}\}/g, projectName);
        tpl = tpl.replace(/\{\{stack\}\}/g, stack);

        // Append stack specific content if exists
        const stackClaudePath = path.join(stackDir, 'CLAUDE.md.append');
        if (fs.existsSync(stackClaudePath)) {
          const appendContent = fs.readFileSync(stackClaudePath, 'utf8');
          tpl += '\n' + appendContent;
        }

        claudeContent = tpl;
      } else {
        log.warn(`[ScaffoldRunner] Missing CLAUDE.md template at ${claudeTemplatePath}`);
      }
    } catch (err: any) {
      log.error(`[ScaffoldRunner] Failed to read templates: ${err.message}`);
    }

    const agentsPath = path.join(repoPath, 'AGENTS.md');
    const claudePath = path.join(repoPath, 'CLAUDE.md');

    if (isNewRepo) {
      if (agentsContent) fs.writeFileSync(agentsPath, agentsContent);
      if (claudeContent) fs.writeFileSync(claudePath, claudeContent);

      try {
        // Copy .claude directory
        const claudeRulesSrc = path.join(commonDir, '.claude');
        if (fs.existsSync(claudeRulesSrc)) {
          this.copyDirSync(claudeRulesSrc, path.join(repoPath, '.claude'));
        }

        // Copy .rtk.config
        const rtkSrc = path.join(commonDir, '.rtk.config');
        if (fs.existsSync(rtkSrc)) {
          fs.copyFileSync(rtkSrc, path.join(repoPath, '.rtk.config'));
        }

        // Append .gitignore_append
        const gitignoreAppendSrc = path.join(commonDir, '.gitignore_append');
        const gitignoreTarget = path.join(repoPath, '.gitignore');
        if (fs.existsSync(gitignoreAppendSrc) && fs.existsSync(gitignoreTarget)) {
          const appendContent = fs.readFileSync(gitignoreAppendSrc, 'utf8');
          fs.appendFileSync(gitignoreTarget, '\n' + appendContent);
        }
      } catch (err: any) {
        log.error(`[ScaffoldRunner] Failed to copy extended templates: ${err.message}`);
      }
    } else {
      // For existing repos, append if they exist, or create if they don't
      if (agentsContent) this.appendOrCreate(agentsPath, agentsContent, '## Genesis Addition');
      if (claudeContent) this.appendOrCreate(claudePath, claudeContent, '## Genesis Addition');
    }
  }

  private copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private appendOrCreate(filePath: string, content: string, marker: string): void {
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf8');
      if (!existing.includes(marker)) {
        fs.appendFileSync(filePath, `\n\n${marker}\n${content}`);
      }
    } else {
      fs.writeFileSync(filePath, content);
    }
  }

  private ensureDocsStructure(repoPath: string): void {
    const dirs = [
      path.join(repoPath, 'docs', 'stories'),
      path.join(repoPath, 'docs', 'stories', 'completed')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const backlogPath = path.join(repoPath, 'BACKLOG.md');
    if (!fs.existsSync(backlogPath)) {
      fs.writeFileSync(backlogPath, '# Project Backlog\n\n');
    }
  }

  private firstCommit(repoPath: string, projectName: string): void {
    try {
      const resAdd = spawnSync('git', ['add', '-A'], { cwd: repoPath });
      if (resAdd.error) throw resAdd.error;
      if (resAdd.status !== 0) throw new Error(`git add exited with ${resAdd.status}`);

      const resCommit = spawnSync('git', ['commit', '-m', `chore: project genesis scaffold — ${projectName}`], { cwd: repoPath });
      if (resCommit.error) throw resCommit.error;
      if (resCommit.status !== 0) throw new Error(`git commit exited with ${resCommit.status}`);
    } catch (err: any) {
      log.warn(`[ScaffoldRunner] first commit failed: ${err.message}`);
    }
  }

  private getStackStructure(stack: string): string[] {
    switch (stack) {
      case 'react-electron': return ['src', 'electron', 'public'];
      case 'react-flask': return ['frontend/src', 'backend', 'scripts'];
      case 'nextjs': return ['app', 'public', 'lib'];
      case 'react-native': return ['src', 'assets'];
      case 'python-cli': return ['src', 'scripts', 'tests'];
      default: return ['src'];
    }
  }

  private getGitignore(stack: string): string {
    const common = 'node_modules\n.env\ndist\nbuild\n*.log\n.DS_Store';
    const python = '\n__pycache__\nvenv\n*.pyc';
    
    switch (stack) {
      case 'react-electron': return common + '\ndist-electron';
      case 'react-flask': return common + python + '\nfrontend/dist';
      case 'python-cli': return common + python;
      default: return common;
    }
  }
}
