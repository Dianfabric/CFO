/**
 * Google Sheets REST API 헬퍼 (클라이언트 사이드)
 * GIS 토큰 (scope: spreadsheets) 사용
 *
 * 잠재 거래처 등록 시 시트 자동 생성 + row append.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

// ============================================================
// 시트 생성/검색
// ============================================================

/**
 * Drive 폴더 안에서 지정된 이름의 스프레드시트 검색 → 없으면 생성.
 * Drive.file scope 로 생성된 시트만 검색·접근 가능 (사용자 다른 시트는 안 보임).
 */
export async function getOrCreateSpreadsheet(
  name: string,
  parentFolderId: string,
  token: string,
  headerColumns?: string[],
): Promise<{ spreadsheetId: string; webViewLink: string; created: boolean }> {
  // 1. Drive 에서 검색
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!searchRes.ok) throw new Error(`Drive search failed: ${searchRes.status}`)
  const searchData = await searchRes.json()
  if (searchData.files?.length > 0) {
    return {
      spreadsheetId: searchData.files[0].id,
      webViewLink: searchData.files[0].webViewLink,
      created: false,
    }
  }

  // 2. Drive 에 빈 스프레드시트 생성 (Drive API 로 만들면 parent 폴더 지정 가능)
  const createRes = await fetch(`${DRIVE_API}/files?fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [parentFolderId],
    }),
  })
  if (!createRes.ok) {
    const txt = await createRes.text()
    throw new Error(`Spreadsheet create failed: ${createRes.status} ${txt}`)
  }
  const created = await createRes.json()
  const spreadsheetId = created.id as string

  // 3. 헤더 입력 (옵션)
  if (headerColumns && headerColumns.length > 0) {
    await appendRow(spreadsheetId, headerColumns, token, 'Sheet1')
    // 헤더 행 굵게 처리 (선택, fail-soft)
    try {
      await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 0,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        }),
      })
    } catch {
      // ignore formatting failure
    }
  }

  return {
    spreadsheetId,
    webViewLink: created.webViewLink,
    created: true,
  }
}

// ============================================================
// Row append
// ============================================================

/** 시트 끝에 row append → 추가된 row 의 1-indexed 번호 반환 */
export async function appendRow(
  spreadsheetId: string,
  values: string[],
  token: string,
  sheetName: string = 'Sheet1',
): Promise<number> {
  const range = `${sheetName}!A:Z`
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [values],
        majorDimension: 'ROWS',
      }),
    },
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Sheet append failed: ${res.status} ${txt}`)
  }
  const j = await res.json()
  // updatedRange = "Sheet1!A5:O5" 형식 → row 번호 추출
  const updatedRange: string = j.updates?.updatedRange ?? ''
  const m = updatedRange.match(/!?[A-Z]+(\d+):/)
  return m ? Number(m[1]) : 0
}

/** 특정 row 의 모든 값을 교체 (update — append 와 다름) */
export async function updateRow(
  spreadsheetId: string,
  rowIndex: number, // 1-indexed
  values: string[],
  token: string,
  sheetName: string = 'Sheet1',
): Promise<void> {
  const lastCol = String.fromCharCode(64 + values.length) // A=65
  const range = `${sheetName}!A${rowIndex}:${lastCol}${rowIndex}`
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [values],
        majorDimension: 'ROWS',
      }),
    },
  )
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Sheet update failed: ${res.status} ${txt}`)
  }
}
