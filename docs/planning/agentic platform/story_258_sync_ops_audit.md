copernicus/electron/devtime-manager.ts:53:      const data = JSON.parse(fs.readFileSync(this.LOCK_PATH, 'utf8'));
copernicus/electron/devtime-manager.ts:69:      fs.writeFileSync(this.LOCK_PATH, JSON.stringify(this.activeSession));
copernicus/electron/auth-manager.ts:35:        const data = fs.readFileSync(this.configPath, 'utf-8');
copernicus/electron/auth-manager.ts:51:      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
copernicus/electron/auth-manager.ts:85:    const { execFileSync } = require('child_process')
copernicus/electron/auth-manager.ts:88:      try { execFileSync(p, ['--version'], { timeout: 3000, stdio: 'ignore' }); return p } catch { /* skip */ }
copernicus/electron/auth-manager.ts:91:      const result = execFileSync('which', ['claude'], { timeout: 3000 }).toString().trim()
copernicus/electron/auth-manager.ts:205:          const content = fs.readFileSync(geminiPath, 'utf-8');
copernicus/electron/auth-manager.ts:209:          return fs.readFileSync(geminiPath, 'utf-8');
copernicus/electron/auth-manager.ts:216:        return fs.readFileSync(anthropicPath, 'utf-8');
copernicus/electron/auth-manager.ts:223:                const content = fs.readFileSync(ghConfigPath, 'utf-8');
copernicus/electron/settings-store.ts:21:        const data = fs.readFileSync(this.configPath, 'utf-8');
copernicus/electron/settings-store.ts:41:          const config = JSON.parse(fs.readFileSync(userDataMcpPath, 'utf-8'));
copernicus/electron/settings-store.ts:56:          const config = JSON.parse(fs.readFileSync(legacyMcpPath, 'utf-8'));
copernicus/electron/settings-store.ts:71:        const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
copernicus/electron/settings-store.ts:84:      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
copernicus/electron/security/sandbox-manager.ts:84:      let content = fs.readFileSync(templatePath, 'utf8');
copernicus/electron/security/sandbox-manager.ts:94:      fs.writeFileSync(profilePath, content);
copernicus/electron/security/sandbox-manager.ts:111:      let content = fs.readFileSync(templatePath, 'utf8');
copernicus/electron/security/sandbox-manager.ts:121:      fs.writeFileSync(profilePath, content);
copernicus/electron/security/git-guard.ts:1:import { execSync } from 'node:child_process';
copernicus/electron/security/git-guard.ts:64:      const output = execSync(`python3 "${auditScript}"`, { cwd: this.projectRoot }).toString();
copernicus/electron/jules/prompt-generator.ts:64:- Use writeFileAtomic() for story .md file writes (never fs.writeFileSync directly).
copernicus/electron/fs-manager.ts:160:    return fs.readFileSync(expandedPath, 'utf-8')
copernicus/electron/fs-manager.ts:177:    fs.writeFileSync(expandedPath, content, 'utf-8')
copernicus/electron/utils/makefile-parser.ts:10:  const content = fs.readFileSync(makefilePath, 'utf-8')
copernicus/electron/codebase-indexer.ts:136:      const content = fs.readFileSync(filePath, 'utf-8')
copernicus/electron/lsp/lsp-manager.ts:19:    const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf-8'))
copernicus/electron/stories.ts:3:import { execSync } from 'node:child_process'
copernicus/electron/stories.ts:25:  fs.writeFileSync(tmp, content, 'utf-8')
copernicus/electron/stories.ts:101:          const content = fs.readFileSync(filePath, 'utf-8')
copernicus/electron/stories.ts:206:            execSync(`python3 "${auditScript}"`, { cwd: this.projectRoot })
copernicus/electron/ipc/auth-handlers.ts:130:          fs.writeFileSync(path.join(geminiDir, 'oauth_creds.json'), JSON.stringify(geminiCreds, null, 2))
copernicus/electron/ipc/app-handlers.ts:3:import { spawn, execFile, execFileSync } from 'node:child_process'
copernicus/electron/ipc/app-handlers.ts:69:    const raw = execFileSync(
copernicus/electron/ipc/app-handlers.ts:267:        const v = execFileSync(bin, ['--version'], { timeout: 3000, shell: false }).toString().trim()
copernicus/electron/ipc/app-handlers.ts:284:        const meta = JSON.parse(fs.readFileSync(p, 'utf-8'))
copernicus/electron/ipc/app-handlers.ts:376:      execFileSync('git', ['init'], { cwd: root, shell: false })
copernicus/electron/ipc/app-handlers.ts:380:      fs.writeFileSync(path.join(root, '.gitignore'), content)
copernicus/electron/ipc/app-handlers.ts:382:    if (opts.authorName) execFileSync('git', ['config', 'user.name', opts.authorName], { cwd: root, shell: false })
copernicus/electron/ipc/app-handlers.ts:383:    if (opts.authorEmail) execFileSync('git', ['config', 'user.email', opts.authorEmail], { cwd: root, shell: false })
copernicus/electron/ipc/app-handlers.ts:399:      try { execFileSync('git', ['init'], { cwd: dirPath, shell: false }) } catch { /* non-fatal */ }
copernicus/electron/ipc/app-handlers.ts:414:      const content = fs.readFileSync(guidePath, 'utf-8')
copernicus/electron/ipc/app-handlers.ts:419:        return fs.readFileSync(fallback, 'utf-8')
