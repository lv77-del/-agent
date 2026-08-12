import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const material = process.env.INTEGRATION_CREDENTIAL_KEY
    || process.env.DATABASE_AUTH_TOKEN
    || process.env.TURSO_AUTH_TOKEN;
  if (!material && process.env.NODE_ENV === "production") {
    throw new Error("未配置 INTEGRATION_CREDENTIAL_KEY，无法安全保存发布密钥");
  }
  return createHash("sha256")
    .update(material || "content-factory-local-development-key")
    .digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("发布密钥格式无效");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
