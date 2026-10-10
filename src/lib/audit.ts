import { prisma } from "./prisma";
import { logger } from "@/lib/logger";

interface LogAuditParams {
  shopId?: string | null;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}

export async function logAudit({
  shopId,
  userId,
  userName,
  action,
  entity,
  entityId,
  details,
  ipAddress,
}: LogAuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        shopId: shopId || null,
        userId: userId || null,
        userName: userName || null,
        action,
        entity,
        entityId: entityId || null,
        details: details || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    logger.error("Audit log error", { error: error });
    // Don't crash main transaction if audit log fails
  }
}
