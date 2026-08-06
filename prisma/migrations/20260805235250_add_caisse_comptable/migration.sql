-- CreateTable
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countedAt" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashCount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CashCount_countedAt_idx" ON "CashCount"("countedAt");
