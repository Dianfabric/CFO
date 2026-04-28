import { NextResponse } from 'next/server'
import { getFabricPrices, getUSDtoKRW, clearFabricCache } from '@/lib/googleSheets'

export async function GET() {
  clearFabricCache()
  const apiKey = process.env.GOOGLE_API_KEY
  const sheetId = process.env.SHEET_ID

  const rawUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('2025 TMS!A:N')}?key=${apiKey}`

  let rawResult: unknown = null
  let rawError: string | null = null
  try {
    const res = await fetch(rawUrl)
    rawResult = await res.json()
  } catch (e) {
    rawError = String(e)
  }

  let prices: unknown[] = []
  let pricesError: string | null = null
  try {
    prices = await getFabricPrices()
  } catch (e) {
    pricesError = String(e)
  }

  let usdRate: number | null = null
  try {
    usdRate = await getUSDtoKRW()
  } catch {}

  return NextResponse.json({
    env: { hasApiKey: !!apiKey, hasSheetId: !!sheetId, sheetId },
    rawUrl,
    rawResult,
    rawError,
    pricesCount: prices.length,
    pricesSample: prices.slice(0, 3),
    pricesError,
    usdRate,
  })
}
