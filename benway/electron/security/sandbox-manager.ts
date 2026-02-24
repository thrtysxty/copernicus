import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Manages OS-level sandbox profiles for agents.
 */
export class SandboxManager {
  private sandboxDir: string;
  private templateDir: string;

  constructor(
    sandboxDir: string = path.join(os.homedir(), '.benway', 'sandbox'),
    templateDir?: string
  ) {
    this.sandboxDir = sandboxDir;

    if (templateDir) {
      this.templateDir = templateDir;
    } else {
      // Best-effort template location resolution
      // In production Electron app, resources are often in process.resourcesPath
      const electronResources = (process as any).resourcesPath;
      if (electronResources && fs.existsSync(path.join(electronResources, 'sandbox'))) {
        this.templateDir = path.join(electronResources, 'sandbox');
      } else {
        // Fallback to local dev path relative to CWD
        this.templateDir = path.join(process.cwd(), 'resources', 'sandbox');
      }
    }

    // Ensure sandbox directory exists
    if (!fs.existsSync(this.sandboxDir)) {
      try {
        fs.mkdirSync(this.sandboxDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create sandbox directory ${this.sandboxDir}:`, err);
      }
    }
  }

  /**
   * Generates a sandbox profile for the given agent and workspace.
   * Returns the command prefix to wrap the execution (e.g. ['sandbox-exec', '-f', '...']).
   * If sandbox is not supported or fails, returns empty array.
   */
  public generateProfile(agentId: string, workspaceRoot: string): string[] {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this.generateMacOSProfile(agentId, workspaceRoot);
    } else if (platform === 'linux') {
      return this.generateLinuxProfile(agentId, workspaceRoot);
    } else {
      // Windows/other not supported yet
      return [];
    }
  }

  private generateMacOSProfile(agentId: string, workspaceRoot: string): string[] {
    const templatePath = path.join(this.templateDir, 'macos-agent.sb.template');
    if (!fs.existsSync(templatePath)) {
      console.warn(`Sandbox template not found: ${templatePath}`);
      return [];
    }

    try {
      let content = fs.readFileSync(templatePath, 'utf8');
      
      // Escape for Scheme string (double quotes)
      const escapedRoot = this.escapeSchemeString(workspaceRoot);
      const escapedHome = this.escapeSchemeString(os.homedir());
      
      content = content.replace(/WORKSPACE_ROOT/g, escapedRoot);
      content = content.replace(/HOME_DIR/g, escapedHome);

      const profilePath = path.join(this.sandboxDir, `${agentId}.sb`);
      fs.writeFileSync(profilePath, content);

      return ['sandbox-exec', '-f', profilePath];
    } catch (err) {
      console.error('Failed to generate macOS sandbox profile:', err);
      return [];
    }
  }

  private generateLinuxProfile(agentId: string, workspaceRoot: string): string[] {
    const templatePath = path.join(this.templateDir, 'linux-agent.profile.template');
    if (!fs.existsSync(templatePath)) {
      console.warn(`Sandbox template not found: ${templatePath}`);
      return [];
    }

    try {
      let content = fs.readFileSync(templatePath, 'utf8');
      
      // Firejail handles spaces but quotes are safer if path contains spaces
      const safeRoot = this.escapeFirejailPath(workspaceRoot);
      const safeHome = this.escapeFirejailPath(os.homedir());
      
      content = content.replace(/WORKSPACE_ROOT/g, safeRoot);
      content = content.replace(/HOME_DIR/g, safeHome);

      const profilePath = path.join(this.sandboxDir, `${agentId}.profile`);
      fs.writeFileSync(profilePath, content);

      return ['firejail', `--profile=${profilePath}`];
    } catch (err) {
      console.error('Failed to generate Linux sandbox profile:', err);
      return [];
    }
  }

  private escapeSchemeString(str: string): string {
    // Escape backslashes and double quotes
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private escapeFirejailPath(str: string): string {
    // If path contains spaces, wrap in quotes
    // Also escape internal quotes if any (though rare in paths)
    if (str.includes(' ')) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }
}
