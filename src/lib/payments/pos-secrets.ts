import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { z } from "zod";
export const posCredentialsSchema = z.object({
    token: z.string().trim().regex(/^aps_[A-Za-z0-9_-]{20,250}$/),
    cashDeskCode: z.string().trim().regex(/^[A-Za-z0-9_-]{3,200}$/),
    webhookSecret: z.string().trim().min(20).max(250),
});
function secretKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32)
        throw new Error("Server maxfiy kaliti sozlanmagan");
    return createHash("sha256").update(`savdoza-pos-credentials-v1:${secret}`).digest();
}
export function sealCredentials(shopId: string, value: z.infer<typeof posCredentialsSchema>) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
    cipher.setAAD(Buffer.from(shopId));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}
export function openCredentials(shopId: string, value: string) {
    const [iv, tag, encrypted] = value.split(".").map(part => Buffer.from(part, "base64url"));
    const cipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
    cipher.setAAD(Buffer.from(shopId));
    cipher.setAuthTag(tag);
    return posCredentialsSchema.parse(JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8")));
}
