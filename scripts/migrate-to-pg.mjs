/**
 * SQLite(dev.db) → Supabase PostgreSQL 데이터 마이그레이션
 * 실행: node scripts/migrate-to-pg.mjs
 */
import Database from 'better-sqlite3'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db')

console.log('📦 SQLite 경로:', dbPath)

const sqlite = new Database(dbPath, { readonly: true })
const pg = new PrismaClient()

function all(sql) {
  return sqlite.prepare(sql).all()
}

async function migrate() {
  console.log('\n🚀 마이그레이션 시작...\n')

  // 1. Users
  const users = all('SELECT * FROM users')
  console.log(`👤 Users: ${users.length}건`)
  for (const u of users) {
    await pg.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        email: u.email,
        passwordHash: u.password_hash,
        name: u.name,
        role: u.role,
        createdAt: new Date(u.created_at),
      },
    })
  }

  // 2. Clients
  const clients = all('SELECT * FROM clients')
  console.log(`🏢 Clients: ${clients.length}건`)
  for (const c of clients) {
    await pg.client.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        businessNumber: c.business_number,
        contactName: c.contact_name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        type: c.type,
        notes: c.notes,
        isActive: c.is_active === 1,
        createdAt: new Date(c.created_at),
        updatedAt: new Date(c.updated_at),
      },
    })
  }

  // 3. Products — Google Sheets 연동으로 자동 채워지므로 스킵
  console.log(`📦 Products: 스킵 (Google Sheets 동기화로 채워짐)`)

  // 4. Transactions
  const transactions = all('SELECT * FROM transactions')
  console.log(`💰 Transactions: ${transactions.length}건`)
  for (const t of transactions) {
    await pg.transaction.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        date: new Date(t.date),
        type: t.type,
        clientId: t.client_id,
        description: t.description,
        totalAmount: t.total_amount,
        taxAmount: t.tax_amount,
        paymentMethod: t.payment_method,
        paymentStatus: t.payment_status,
        channel: t.channel,
        notes: t.notes,
        createdById: t.created_by_id,
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
      },
    })
  }

  // 5. TransactionItems
  const items = all('SELECT * FROM transaction_items')
  console.log(`📋 TransactionItems: ${items.length}건`)
  for (const i of items) {
    await pg.transactionItem.upsert({
      where: { id: i.id },
      update: {},
      create: {
        id: i.id,
        transactionId: i.transaction_id,
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        amount: i.amount,
        notes: i.notes,
      },
    })
  }

  // 6. AccountsReceivable
  const ars = all('SELECT * FROM accounts_receivable')
  console.log(`📑 AccountsReceivable: ${ars.length}건`)
  for (const ar of ars) {
    await pg.accountsReceivable.upsert({
      where: { id: ar.id },
      update: {},
      create: {
        id: ar.id,
        clientId: ar.client_id,
        transactionId: ar.transaction_id,
        originalAmount: ar.original_amount,
        remainingAmount: ar.remaining_amount,
        dueDate: ar.due_date ? new Date(ar.due_date) : null,
        status: ar.status,
        notes: ar.notes,
        createdAt: new Date(ar.created_at),
        updatedAt: new Date(ar.updated_at),
      },
    })
  }

  // 7. ArPayments
  const payments = all('SELECT * FROM ar_payments')
  console.log(`💳 ArPayments: ${payments.length}건`)
  for (const p of payments) {
    await pg.arPayment.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        receivableId: p.receivable_id,
        amount: p.amount,
        paymentDate: new Date(p.payment_date),
        paymentMethod: p.payment_method,
        notes: p.notes,
        createdAt: new Date(p.created_at),
      },
    })
  }

  // 8. CostCategories
  const cats = all('SELECT * FROM cost_categories')
  console.log(`🏷️  CostCategories: ${cats.length}건`)
  for (const c of cats) {
    await pg.costCategory.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        type: c.type,
        isActive: c.is_active === 1,
      },
    })
  }

  // 9. RecurringCosts
  const recurring = all('SELECT * FROM recurring_costs')
  console.log(`🔄 RecurringCosts: ${recurring.length}건`)
  for (const r of recurring) {
    await pg.recurringCost.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        costCategoryId: r.cost_category_id,
        description: r.description,
        amount: r.amount,
        frequency: r.frequency,
        notes: r.notes,
      },
    })
  }

  // 10. MonthlyCosts
  const monthly = all('SELECT * FROM monthly_costs')
  console.log(`📅 MonthlyCosts: ${monthly.length}건`)
  for (const m of monthly) {
    await pg.monthlyCost.upsert({
      where: { costCategoryId_yearMonth: { costCategoryId: m.cost_category_id, yearMonth: m.year_month } },
      update: { amount: m.amount, notes: m.notes, source: m.source },
      create: {
        id: m.id,
        costCategoryId: m.cost_category_id,
        yearMonth: m.year_month,
        amount: m.amount,
        source: m.source,
        notes: m.notes,
        createdAt: new Date(m.created_at),
        updatedAt: new Date(m.updated_at),
      },
    })
  }

  // 11. CompanyProfile
  const profiles = all('SELECT * FROM company_profile')
  console.log(`🏭 CompanyProfile: ${profiles.length}건`)
  for (const p of profiles) {
    await pg.companyProfile.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        businessNumber: p.business_number,
        representative: p.representative,
        phone: p.phone,
        fax: p.fax,
        address: p.address,
        email: p.email,
        website: p.website,
        bankInfo: p.bank_info,
        logoPath: p.logo_path,
        sealPath: p.seal_path,
        updatedAt: new Date(p.updated_at),
      },
    })
  }

  // 12. OfficialDocuments
  const docs = all('SELECT * FROM official_documents')
  console.log(`📄 OfficialDocuments: ${docs.length}건`)
  for (const d of docs) {
    await pg.officialDocument.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id: d.id,
        documentNumber: d.document_number,
        type: d.type,
        title: d.title,
        recipientClientId: d.recipient_client_id,
        recipientName: d.recipient_name,
        ccLine: d.cc_line,
        senderLine: d.sender_line,
        bodyText: d.body_text,
        tableJson: d.table_json,
        metaJson: d.meta_json,
        driveFileId: d.drive_file_id,
        driveJpgId: d.drive_jpg_id,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at),
      },
    })
  }

  console.log('\n✅ 마이그레이션 완료!')
  sqlite.close()
  await pg.$disconnect()
}

migrate().catch(e => {
  console.error('❌ 마이그레이션 실패:', e)
  sqlite.close()
  pg.$disconnect()
  process.exit(1)
})
