-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT,
    "tableNumber" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "source" TEXT NOT NULL DEFAULT 'INTERNE',
    "type" TEXT NOT NULL DEFAULT 'SUR_PLACE',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "userId" TEXT,
    "deliveryAddress" TEXT,
    "deliveryNote" TEXT,
    "deliveryStatus" TEXT,
    "livreurId" TEXT,
    "assignedAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "customerName", "customerPhone", "id", "source", "status", "tableNumber", "updatedAt", "userId") SELECT "createdAt", "customerName", "customerPhone", "id", "source", "status", "tableNumber", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

-- Les commandes déjà en base n'ont pas de référence : on leur en attribue une pour
-- qu'elles restent consultables. Préfixe X pour les distinguer des références émises
-- par l'application. L'index unique est créé après, afin qu'une collision échoue
-- bruyamment plutôt que de passer inaperçue.
UPDATE "Order" SET "reference" = 'X' || substr(hex(randomblob(8)), 1, 5) WHERE "reference" IS NULL;

-- Avant la livraison, une commande en ligne était forcément à emporter.
UPDATE "Order" SET "type" = 'A_EMPORTER' WHERE "source" = 'EN_LIGNE';

CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");
CREATE INDEX "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
