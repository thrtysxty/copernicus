import { ExtensionHostManager } from './ExtensionHostManager'

export interface PendingExtension {
  extensionPath: string;
  extensionName: string;
  displayName: string;
  capabilities: any;
  events: string[];
}

export class ExtensionActivationBus {
  private pendingExtensions: Map<string, PendingExtension> = new Map()
  private activatedExtensions: Set<string> = new Set()

  constructor(private hostManager: ExtensionHostManager) {}

  register(extensionPath: string, extensionName: string, displayName: string, capabilities: any, events: string[]): void {
    if (this.activatedExtensions.has(extensionPath)) return;

    // Extensions with NO activationEvents declared are treated as ['*']
    const normalizedEvents = (!events || events.length === 0) ? ['*'] : events;

    this.pendingExtensions.set(extensionPath, {
      extensionPath,
      extensionName,
      displayName,
      capabilities,
      events: normalizedEvents
    })
  }

  async fire(event: string): Promise<void> {
    const toActivate: PendingExtension[] = [];

    for (const [path, pending] of this.pendingExtensions.entries()) {
      if (pending.events.includes(event) || pending.events.includes('*')) {
        toActivate.push(pending)
        this.pendingExtensions.delete(path)
        this.activatedExtensions.add(path)
      }
    }

    for (const ext of toActivate) {
      await this.hostManager.activateExtension(ext.extensionName, ext.displayName, ext.capabilities, ext.extensionPath, true)
    }
  }
}
