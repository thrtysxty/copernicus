import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { providerRegistry } from './llm/provider-registry';
import { SettingsStore } from './settings-store';
import log from 'electron-log';

class MLXProvider {
  private serverProcess: ChildProcess | null = null;
  private currentModelId: string | null = null;
  private restartCount: number = 0;
  private readonly MAX_RESTARTS = 3;
  private latestPerfMetrics: string | null = null;
  private isMlxLmInstalled: boolean | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Basic setup without settingsStore dependency until app starts
  }

  public initializeWithSettings(settingsStore: SettingsStore) {
    const isAppleSilicon = process.arch === 'arm64' && process.platform === 'darwin';
    settingsStore.setAndVerify('platform.appleSilicon', isAppleSilicon);

    if (!isAppleSilicon) {
      log.info('Non-Apple Silicon detected. MLX Native Provider will not be initialized.');
      return;
    }

    log.info('Apple Silicon detected. Initializing MLX Native Provider.');
    this.registerProvider();
    this.checkPrerequisites();

    app.on('will-quit', () => {
      this.shutdown();
    });
  }

  private checkPrerequisites() {
    // Check if mlx-lm is installed via pip show mlx-lm
    const proc = spawn('pip3', ['show', 'mlx-lm']);
    proc.on('error', (err) => {
      log.error(`Failed to check prerequisites (pip3): ${err.message}`);
      this.isMlxLmInstalled = false;
    });
    proc.on('close', (code) => {
      this.isMlxLmInstalled = code === 0;
      log.info(`Prerequisite check: mlx-lm installed = ${this.isMlxLmInstalled}`);
    });
  }

  public getPrerequisiteStatus(): boolean | null {
    return this.isMlxLmInstalled;
  }

  private registerProvider() {
    providerRegistry.register({
      id: 'mlx-native',
      displayName: 'MLX (Apple Silicon)',
      baseUrl: 'http://localhost:8080/v1',
      resolveKey: () => null, // requires_api_key: false
      supportsToolCalling: true, // we assume it does via compatible API
      // Custom metadata for MLX per AC3
      ...({
        platform: 'apple-silicon',
        inference: 'local',
        cost_per_token: 0,
        requires_api_key: false,
        status: 'AVAILABLE'
      }) as any
    });
  }

  public isRunning(): boolean {
    return this.serverProcess !== null && this.serverProcess.pid !== undefined && !this.serverProcess.killed;
  }

  public currentModel(): string | null {
    return this.currentModelId;
  }

  public getLatestPerf(): string | null {
    return this.latestPerfMetrics;
  }

  public restart(modelId: string) {
    this.shutdown();
    this.currentModelId = modelId;
    this.restartCount = 0;
    this.startServer();
  }

  private startServer() {
    if (!this.currentModelId) return;

    log.info(`Starting mlx_lm.server with model: ${this.currentModelId}`);

    // Spawn mlx_lm.server
    this.serverProcess = spawn('python3', ['-m', 'mlx_lm.server', '--model', this.currentModelId, '--port', '8080']);

    this.serverProcess.on('error', (err) => {
      log.error(`mlx_lm.server failed to start: ${err.message}`);
    });

    this.serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      // Look for tokens/sec in output
      const match = output.match(/([\d.]+\s*tok\/s)/);
      if (match) {
        this.latestPerfMetrics = match[1];
      }
    });

    this.serverProcess.stderr?.on('data', (data) => {
      // mlx_lm often writes to stderr
      log.info(`[mlx_lm] ${data.toString().trim()}`);
    });

    const proc = this.serverProcess;
    proc.on('exit', (code, signal) => {
      log.info(`mlx_lm.server exited with code ${code} and signal ${signal}`);
      if (this.serverProcess === proc) {
        this.serverProcess = null;
      }

      // If killed via signal (e.g. shutdown or restart), do not auto-restart
      if (signal) {
        return;
      }

      if (this.restartCount < this.MAX_RESTARTS && code !== 0) {
        this.restartCount++;
        log.info(`Restarting mlx_lm.server (attempt ${this.restartCount}/${this.MAX_RESTARTS})...`);
        setTimeout(() => this.startServer(), 2000);
      } else if (this.restartCount >= this.MAX_RESTARTS) {
        log.error(`mlx_lm.server failed to start after ${this.MAX_RESTARTS} attempts.`);
      }
    });
  }

  public shutdown() {
    if (this.serverProcess) {
      log.info('Shutting down mlx_lm.server...');
      const proc = this.serverProcess;
      this.serverProcess = null;
      proc.kill();
    }
  }
}

export const mlxProvider = new MLXProvider();
