let safeStorage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require('electron');
  safeStorage = electron.safeStorage;
} catch (e) {
  // Not in electron
}

export interface EncryptedCredentials {
  [provider: string]: string; // base64 encoded buffer
}

export class SafeStorageWrapper {
  static isAvailable(): boolean {
    return !!safeStorage && safeStorage.isEncryptionAvailable();
  }

  static encrypt(plaintext: string): string {
    if (!this.isAvailable()) {
      // For testing outside Electron, return a mock encrypted string
      if (process.env.NODE_ENV === 'test') return Buffer.from(plaintext).toString('base64');
      throw new Error('Encryption is not available on this system.');
    }
    const encryptedBuffer = safeStorage.encryptString(plaintext);
    return encryptedBuffer.toString('base64');
  }

  static decrypt(encryptedBase64: string): string {
    if (!this.isAvailable()) {
      // For testing outside Electron, return the mock decrypted string
      if (process.env.NODE_ENV === 'test') return Buffer.from(encryptedBase64, 'base64').toString();
      throw new Error('Encryption is not available on this system.');
    }
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(encryptedBuffer);
  }
}
