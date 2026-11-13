-- Open the existing priced plans for self-service purchase.
-- Superadmin can close a plan again in tariff settings.
UPDATE "Plan" SET "enabled" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('PRO', 'MAX') AND "price" > 0;
