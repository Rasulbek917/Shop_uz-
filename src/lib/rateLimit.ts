import { createHash } from "crypto";
import { prisma } from "./prisma";

function attemptKey(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

export async function takeAuthAttempt(identifier: string, maxAttempts = 5, windowMinutes = 10) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMinutes * 60000);
  // Keep the shared store bounded over time without recording raw logins or IPs.
  await prisma.authThrottle.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 86400000) } } });
  const rows = await prisma.$queryRaw<{ attempts: number; resetAt: Date }[]>`
    INSERT INTO "AuthThrottle" ("key", "attempts", "resetAt") VALUES (${attemptKey(identifier)}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthThrottle"."resetAt" <= ${now} THEN 1 ELSE LEAST("AuthThrottle"."attempts" + 1, ${maxAttempts + 1}) END,
      "resetAt" = CASE WHEN "AuthThrottle"."resetAt" <= ${now} THEN ${resetAt} ELSE "AuthThrottle"."resetAt" END
    RETURNING "attempts", "resetAt"`;
  const row = rows[0];
  return {
    allowed: row.attempts <= maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - row.attempts),
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
  };
}

export async function resetAuthAttempts(identifier: string) {
  await prisma.authThrottle.deleteMany({ where: { key: attemptKey(identifier) } });
}
