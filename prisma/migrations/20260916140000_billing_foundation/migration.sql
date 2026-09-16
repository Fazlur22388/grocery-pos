-- Rebuild only the Product table to change SQLite column declarations.
-- Copy every existing field without rounding or replacing any product values.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL NOT NULL CHECK ("price" >= 0),
    "pricingAmount" DECIMAL NOT NULL DEFAULT 1 CHECK ("pricingAmount" > 0),
    "unit" TEXT NOT NULL DEFAULT 'Pcs',
    "quantity" DECIMAL NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
    "version" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "barcode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("id", "name", "category", "price", "pricingAmount", "unit", "quantity", "image", "barcode", "createdAt", "updatedAt")
SELECT "id", "name", "category", "price", "pricingAmount", "unit", "quantity", "image", "barcode", "createdAt", "updatedAt" FROM "Product";

-- Preserve the ID high-water mark, including IDs of previously deleted products.
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'Product'), 0)) WHERE name = 'new_Product';
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

CREATE TABLE "Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL CHECK ("subtotal" >= 0),
    "discount" DECIMAL NOT NULL DEFAULT 0 CHECK ("discount" >= 0 AND "discount" <= "subtotal"),
    "total" DECIMAL NOT NULL CHECK ("total" >= 0),
    "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('CASH', 'CARD')),
    "amountTendered" DECIMAL,
    "changeDue" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Sale_requestId_key" ON "Sale"("requestId");

CREATE TABLE "SaleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "barcode" TEXT,
    "unit" TEXT NOT NULL,
    "pricingAmount" DECIMAL NOT NULL CHECK ("pricingAmount" > 0),
    "unitPrice" DECIMAL NOT NULL CHECK ("unitPrice" >= 0),
    "quantity" DECIMAL NOT NULL CHECK ("quantity" > 0),
    "lineTotal" DECIMAL NOT NULL CHECK ("lineTotal" >= 0),
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
COMMIT;
PRAGMA foreign_keys=ON;
