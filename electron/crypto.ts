import CryptoJS from 'crypto-js';

export interface EncryptResult {
  encrypted: string;
  iv?: string;
}

export interface HashResult {
  hash: string;
  salt?: string;
}

class CryptoManager {
  private defaultSecretKey: string;

  constructor() {
    this.defaultSecretKey = this.generateDefaultKey();
  }

  private generateDefaultKey(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  setKey(key: string): void {
    if (!key || key.length < 16) {
      throw new Error('密钥长度至少为16个字符');
    }
    this.defaultSecretKey = key;
  }

  aesEncrypt(data: string, secretKey?: string): EncryptResult {
    const key = secretKey || this.defaultSecretKey;
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(),
    };
  }

  aesDecrypt(
    encryptedData: string,
    iv: string,
    secretKey?: string
  ): string {
    const key = secretKey || this.defaultSecretKey;
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  simpleEncrypt(data: string, secretKey?: string): string {
    const key = secretKey || this.defaultSecretKey;
    return CryptoJS.AES.encrypt(data, key).toString();
  }

  simpleDecrypt(encryptedData: string, secretKey?: string): string {
    const key = secretKey || this.defaultSecretKey;
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  generateMD5(data: string): string {
    return CryptoJS.MD5(data).toString();
  }

  generateSHA256(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  generateSHA512(data: string): string {
    return CryptoJS.SHA512(data).toString();
  }

  hashPassword(password: string, salt?: string): HashResult {
    const finalSalt = salt || CryptoJS.lib.WordArray.random(16).toString();
    const hash = CryptoJS.PBKDF2(password, finalSalt, {
      keySize: 256 / 32,
      iterations: 10000,
    }).toString();
    return {
      hash,
      salt: finalSalt,
    };
  }

  verifyPassword(
    password: string,
    storedHash: string,
    storedSalt: string
  ): boolean {
    const result = this.hashPassword(password, storedSalt);
    return result.hash === storedHash;
  }

  generateRandomString(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length / 2).toString();
  }

  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

export const cryptoManager = new CryptoManager();
export default CryptoManager;
