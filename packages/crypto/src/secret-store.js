"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretStore = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
class SecretStore {
    key;
    constructor(encryptionKey) {
        this.key = node_crypto_1.default.scryptSync(encryptionKey, 'salt', 32);
    }
    encrypt(text) {
        const iv = node_crypto_1.default.randomBytes(IV_LENGTH);
        const cipher = node_crypto_1.default.createCipheriv(ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([iv, tag, encrypted]).toString('base64');
    }
    decrypt(cipherText) {
        const data = Buffer.from(cipherText, 'base64');
        const iv = data.subarray(0, IV_LENGTH);
        const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = node_crypto_1.default.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    }
}
exports.SecretStore = SecretStore;
