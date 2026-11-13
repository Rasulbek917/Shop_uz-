INSERT INTO "Plan" ("code", "name", "price", "updatedAt") VALUES ('PRO', 'Pro', 299000, CURRENT_TIMESTAMP), ('MAX', 'Max', 499000, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "price" = EXCLUDED."price", "updatedAt" = CURRENT_TIMESTAMP;
