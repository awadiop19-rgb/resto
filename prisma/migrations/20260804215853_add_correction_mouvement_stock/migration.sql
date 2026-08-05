-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL,
    "supplier" TEXT,
    "note" TEXT,
    "expenseId" TEXT,
    "originalQuantity" REAL,
    "originalUnitPrice" REAL,
    "correctionNote" TEXT,
    "correctedById" TEXT,
    "correctedAt" DATETIME,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("createdAt", "date", "expenseId", "id", "note", "productId", "quantity", "supplier", "type", "unitPrice", "userId") SELECT "createdAt", "date", "expenseId", "id", "note", "productId", "quantity", "supplier", "type", "unitPrice", "userId" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE UNIQUE INDEX "StockMovement_expenseId_key" ON "StockMovement"("expenseId");
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX "StockMovement_date_idx" ON "StockMovement"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
