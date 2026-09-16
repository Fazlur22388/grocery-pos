# Billing Phase 1

Implemented on `feature/billing-core`, starting from `1e2304f` (same as main).
There is no checkout UI, cart, receipt, sales-history UI, Customer or StockMovement model.

## Database and preservation

Migration: `20260916140000_billing_foundation`.

- `Product.price`: Float -> Decimal.
- `Product.pricingAmount`: Float -> Decimal, default 1 retained.
- `Product.quantity`: Int -> Decimal, default 0 retained.
- Added `Product.version Int @default(0)` and `Product.saleItems SaleItem[]`.
- All other Product fields, IDs, timestamps and existing values are retained.
- Added Sale and SaleItem as defined below. SQLite CHECK constraints also reject
  negative stock/prices, nonpositive pricing amounts and invalid payment methods.

```prisma
model Sale {
  id             Int        @id @default(autoincrement())
  requestId      String     @unique
  subtotal       Decimal
  discount       Decimal    @default(0)
  total          Decimal
  paymentMethod  String
  amountTendered Decimal?
  changeDue      Decimal?
  createdAt      DateTime   @default(now())
  items          SaleItem[]
}

model SaleItem {
  id            Int      @id @default(autoincrement())
  saleId        Int
  productId     Int?
  productName   String
  barcode       String?
  unit          String
  pricingAmount Decimal
  unitPrice     Decimal
  quantity      Decimal
  lineTotal     Decimal
  sale          Sale     @relation(fields: [saleId], references: [id], onDelete: Restrict)
  product       Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([saleId])
  @@index([productId])
}
```

The custom SQLite migration copies Product into a table with the new column
declarations inside a transaction. It preserves the autoincrement high-water
mark. It does not reset or recreate the database. Historical SaleItems retain
their snapshots when a product is edited, and only `productId` becomes null
when a product is deleted.

Before applying locally, a SQLite `VACUUM INTO` backup was made at
`data/backups/before-billing-phase1-20260916.db`. The adjacent JSON file contains
the pre-migration products and SHA-256 image hashes. The migration was rehearsed
on a copy before application. All fields of the original products (IDs 2, 3, 5),
including timestamps, matched afterward. All three original images matched their
hashes. No live sales were created by testing.

## Numeric contract and assumptions

- Product stock and sold quantity use the same unit as `Product.unit`.
- The API does not convert Kg to g or Ltr to ml. Convert the requested quantity
  to the product's unit before submission.
- g, Kg, ml and Ltr allow up to 3 fractional digits; Pcs, Pkt and Bottle require
  whole stock/sold quantities.
- Pricing amounts allow up to 3 fractional digits and must be positive.
- Quantities/pricing amounts cannot exceed `999999999.999`.
- Price, discount and cash tendered allow up to 2 fractional digits and cannot
  exceed `999999999.99`. Inputs outside these limits are rejected, not rounded.
- Arithmetic uses a 40-digit Decimal context with ROUND_HALF_UP. No authoritative
  calculation uses JavaScript Number arithmetic.
- Duplicate product lines are combined, then each product line total is rounded
  to 2 decimal places. Subtotal is the sum of these rounded lines. Discount is
  subtracted afterward. Total and cash change have 2 decimal places.
- SQLite DECIMAL has NUMERIC affinity, not a native fixed-decimal storage engine.
  Bounded precision keeps persisted values within a conservative round-trip range.
  Stock subtraction is performed in Decimal and conditionally saved, rather than
  using SQLite floating-point subtraction. Arbitrary-precision storage is not claimed.
  See [SQLite types](https://www.sqlite.org/datatype3.html) and
  [Prisma 6 SQLite mapping](https://docs.prisma.io/docs/orm/v6/overview/databases/sqlite).
- The three existing products retain their original `unit = Pcs` and pricing
  settings. They are not reinterpreted from names/categories. Edit these settings
  deliberately before using weighted checkout for those products.

## Product API

GET list, GET by ID, POST, PATCH and exact barcode lookup all use this shape:

```json
{
  "id": 10,
  "name": "Cashew nuts",
  "category": "Grocery",
  "price": "700.00",
  "pricingAmount": "100",
  "unit": "g",
  "quantity": "5000",
  "version": 0,
  "barcode": "0001234567890",
  "image": null,
  "createdAt": "2026-09-16T14:00:00.000Z",
  "updatedAt": "2026-09-16T14:00:00.000Z"
}
```

Decimal fields are JSON strings. Inputs may be JSON numbers or decimal strings;
strings are recommended to avoid client-side floating-point conversion. IDs and
version remain numbers. UI formatting is separate from server calculations.

`GET /api/products/by-barcode/0001234567890` returns exactly one matching product,
or 404. No numeric conversion, substring matching or case folding is applied.

`PATCH /api/products/10` requires `version` from the last product GET. It accepts
partial product fields. The SQL update matches both ID and version and increments
version; checkout also increments it. A stale version returns 409 PRODUCT_CHANGED.
Missing/invalid version returns 400 VERSION_REQUIRED. The existing edit dialog
sends its loaded version automatically and displays the conflict message.

```json
{ "version": 0, "price": "750.00" }
```

Image processing runs only if name, category or image actually changes. A missing
unchanged photo cannot block a stock-only or price-only update. Existing upload
and serving routes are unchanged.

## POST /api/sales

Request (`Content-Type: application/json`):

```json
{
  "requestId": "postman-cash-001",
  "items": [{ "productId": 10, "quantity": "250" }],
  "discount": "50.00",
  "paymentMethod": "CASH",
  "amountTendered": "2000.00"
}
```

Rules: requestId is a nonblank string up to 128 characters, and there must be
1–200 lines. Quantity must be positive. Product prices and names always come
from the database; client-supplied price/total fields have no effect. Discount
defaults to zero and cannot exceed subtotal. CASH requires sufficient tendered
cash. CARD needs no amountTendered and stores amountTendered/changeDue as null.

Response: HTTP 201 for a new sale; HTTP 200 for a replay:

```json
{
  "sale": {
    "id": 1,
    "invoiceNumber": "INV-000001",
    "requestId": "postman-cash-001",
    "subtotal": "1750.00",
    "discount": "50.00",
    "total": "1700.00",
    "paymentMethod": "CASH",
    "amountTendered": "2000.00",
    "changeDue": "300.00",
    "createdAt": "2026-09-16T14:00:00.000Z",
    "items": [{
      "id": 1,
      "saleId": 1,
      "productId": 10,
      "productName": "Cashew nuts",
      "barcode": "0001234567890",
      "unit": "g",
      "pricingAmount": "100",
      "unitPrice": "700.00",
      "quantity": "250",
      "lineTotal": "1750.00"
    }]
  },
  "replayed": false
}
```

The first completed sale for a requestId wins. Reusing that ID returns the stored
sale even if the later payload differs, prices change or a product is deleted.
Use a new requestId for a new sale; retain the same ID when retrying a timeout.

Errors use `{ "error": "Readable message", "code": "MACHINE_CODE" }`:

| HTTP | Examples |
| --- | --- |
| 400 | INVALID_JSON, INVALID_REQUEST_ID, INVALID_ITEMS, INVALID_INPUT, INVALID_PRODUCT_ID, WHOLE_QUANTITY_REQUIRED, INVALID_DISCOUNT, INVALID_PAYMENT_METHOD, INSUFFICIENT_CASH, TOTAL_TOO_LARGE |
| 404 | PRODUCT_NOT_FOUND |
| 409 | INSUFFICIENT_STOCK, STOCK_CHANGED, INVALID_PRODUCT_PRICING, PRODUCT_CHANGED |
| 503 | DATABASE_BUSY: retry with the same requestId |
| 500 | INTERNAL_ERROR |

## Atomicity and concurrency

An interactive Serializable Prisma transaction loads current products, validates
stock/pricing, writes conditional stock changes, creates the sale and snapshots.
Any failure rolls back all changes, including product versions and timestamps.

Each stock write matches product ID, loaded version and sufficient quantity.
The new balance is calculated using Decimal; version is incremented in the same
write. A lost comparison aborts checkout. A unique Sale.requestId constraint
protects against concurrent duplicates. Database conflicts receive bounded
retries, and a committed duplicate is returned as a replay. No checkout request
calls the Product PATCH HTTP endpoint.

## Postman walkthrough

These manual requests intentionally create products/sales in whichever server
you target. Use dedicated test products rather than the shop's three originals.
Base URL: `http://localhost:3000`.

1. POST `/api/products`:

   ```json
   { "name": "Billing test cashews", "category": "Test", "price": "700.00", "pricingAmount": "100", "unit": "g", "quantity": "5000", "barcode": "0001234567890" }
   ```

   Save its returned ID as `cashewId`; do not assume ID 10 from the examples.

2. GET `/api/products/by-barcode/0001234567890`: expect the same product. GET
   `/api/products/by-barcode/1234567890`: expect 404 (leading zeroes matter).

3. POST `/api/sales` using the cash example above with `cashewId`. Expect 201,
   total `1700.00`, change `300.00`, and stock `4750`.

4. Repeat the identical request. Expect 200, `replayed: true`, same sale ID and
   unchanged stock `4750`.

5. POST a new sale:

   ```json
   { "requestId": "postman-card-001", "items": [{ "productId": 10, "quantity": "0.5" }], "paymentMethod": "CARD" }
   ```

   Replace ID 10 with `cashewId`. Expect `3.50` total and null cash fields.

6. With fresh requestIds, try quantity `999999`, discount `9999`, or CASH with
   tendered `1` for 250 g. Expect stock/payment/discount errors and no deductions.

7. Create a test product with unit Pcs, pricingAmount 1, price 400 and stock 10.
   Sell 2: expect total `800.00`. Sell `0.5`: expect 400. Repeat fractional checks
   for separate Pkt and Bottle test products.

8. GET a test product and save its version. Complete a sale for it. PATCH with
   the old version and an old quantity: expect 409. GET again and use the new
   version for a valid edit.

9. Edit the test product name/price, then replay its earlier sale requestId.
   Snapshots remain unchanged. Delete that test product and replay again:
   snapshots remain, with `productId: null`.

10. Submit two distinct requestIds simultaneously against a test product with
    stock 1, each selling 1. Only one can succeed. Submit the same requestId twice
    concurrently: only one sale and one stock deduction should exist.

## Verification

- Prisma schema validation, migration rehearsal, live migration and generation passed.
- TypeScript and ESLint passed.
- `npm run test:billing` runs isolated database tests and never uses the shop DB.
- Browser verification on the rehearsal DB covered catalogue/images, adding and
  editing decimal stock, and stale-edit conflict behavior without runtime errors.
- Initial generation hit a Windows engine file lock from the dev server; stopping
  that server resolved it. Prisma remained at 6.19.0; no packages were added.

## Changed/created source files

Modified: `.gitignore`, `package.json`, `prisma/schema.prisma`,
`src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`,
`src/components/products/product.ts`, `src/components/products/product-dialog.tsx`,
`src/components/products/product-image-picker.tsx`,
`src/components/products/product-table.tsx`, `src/components/products/products-screen.tsx`,
`src/lib/product-pricing.ts`.

Created: `prisma/migrations/20260916140000_billing_foundation/migration.sql`,
`src/app/api/sales/route.ts`, `src/app/api/products/by-barcode/[barcode]/route.ts`,
`src/lib/api-errors.ts`, `src/lib/decimal.ts`, `src/lib/format.ts`,
`src/lib/product-input.ts`, `src/lib/sales.ts`, `src/lib/serialization.ts`,
`tests/billing.test.cjs`, `docs/billing-phase1.md`.

Local ignored artifacts: migrated `prisma/dev.db`, the backup DB/JSON and rehearsal
DB under `data/backups/`, generated Prisma Client and development/browser artifacts.
No existing product image was modified or deleted.
