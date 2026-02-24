export class CustomProviderAuth {
  static getEnvKey(envVarName: string): string | null {
    return process.env[envVarName] || null;
  }
}
