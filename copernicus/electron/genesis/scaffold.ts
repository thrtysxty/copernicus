import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
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

    const agentsContent = `# AGENTS.md — ${projectName}

## Project
${idea}

**For:** ${audience}
**Core value:** ${coreValue}
**Stack:** ${stack}

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

    const claudeContent = `# CLAUDE.md
**Project:** ${projectName}
**Stack:** ${stack}

## Role Boundaries — ENFORCED
Claude's role is Plan → Delegate → Review. Not implement.

## Common Commands
\`\`\`bash
# Add project-specific commands here
\`\`\`

## Architecture
- Defined as project develops
`;

    const agentsPath = path.join(repoPath, 'AGENTS.md');
    const claudePath = path.join(repoPath, 'CLAUDE.md');

    if (isNewRepo) {
      fs.writeFileSync(agentsPath, agentsContent);
      fs.writeFileSync(claudePath, claudeContent);
    } else {
      // For existing repos, append if they exist, or create if they don't
      this.appendOrCreate(agentsPath, agentsContent, '## Genesis Addition');
      this.appendOrCreate(claudePath, claudeContent, '## Genesis Addition');
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
