// Stub — implemented by story 686
export class ExtensionTrustStore {
  isTrusted(_extensionName: string): boolean { return true }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  approve(_extensionName: string, _capabilities: any): void {}
  revoke(_extensionName: string): void {}
}
