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
    "quartierId" TEXT,
    "deliveryFee" REAL,
    "waveDeclaredAt" DATETIME,
    "waveReference" TEXT,
    "deliveryStatus" TEXT,
    "livreurId" TEXT,
    "assignedAt" DATETIME,
    "deliveredAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("assignedAt", "createdAt", "customerName", "customerPhone", "deliveredAt", "deliveryAddress", "deliveryFee", "deliveryNote", "deliveryStatus", "id", "livreurId", "quartierId", "reference", "source", "status", "tableNumber", "type", "updatedAt", "userId", "waveDeclaredAt", "waveReference") SELECT "assignedAt", "createdAt", "customerName", "customerPhone", "deliveredAt", "deliveryAddress", "deliveryFee", "deliveryNote", "deliveryStatus", "id", "livreurId", "quartierId", "reference", "source", "status", "tableNumber", "type", "updatedAt", "userId", "waveDeclaredAt", "waveReference" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");
CREATE INDEX "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
