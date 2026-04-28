-- CreateTable
CREATE TABLE "company_profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "name" TEXT NOT NULL DEFAULT '',
    "business_number" TEXT,
    "representative" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "address" TEXT,
    "email" TEXT,
    "website" TEXT,
    "bank_info" TEXT,
    "logo_path" TEXT,
    "seal_path" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "official_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recipient_client_id" TEXT,
    "recipient_name" TEXT NOT NULL,
    "cc_line" TEXT,
    "sender_line" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "table_json" TEXT,
    "meta_json" TEXT,
    "drive_file_id" TEXT,
    "drive_jpg_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "purchase_price" INTEGER NOT NULL DEFAULT 0,
    "selling_price" INTEGER NOT NULL DEFAULT 0,
    "spec" TEXT,
    "alias" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LOCAL',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_products" ("category", "created_at", "description", "id", "is_active", "name", "purchase_price", "selling_price", "unit", "updated_at") SELECT "category", "created_at", "description", "id", "is_active", "name", "purchase_price", "selling_price", "unit", "updated_at" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "official_documents_document_number_key" ON "official_documents"("document_number");

-- CreateIndex
CREATE INDEX "official_documents_type_created_at_idx" ON "official_documents"("type", "created_at");

-- CreateIndex
CREATE INDEX "official_documents_document_number_idx" ON "official_documents"("document_number");
