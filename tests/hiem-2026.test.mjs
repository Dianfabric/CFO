import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const outDir = '/tmp/dian-cfo-hiem-2026-test-dist'
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

execFileSync('npx', [
  'tsc', 'src/lib/hiem-2026.ts', '--target', 'ES2022', '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext', '--skipLibCheck', '--outDir', outDir,
], { cwd: '/Users/dian/CFO', stdio: 'inherit' })
assert.equal(existsSync(`${outDir}/hiem-2026.js`), true)

const { hiem2026Booths, boothSummary } = await import(`file://${outDir}/hiem-2026.js`)

assert.equal(hiem2026Booths.filter((booth) => booth.status === 'confirmed').length, 26)
assert.equal(hiem2026Booths.filter((booth) => booth.status === 'pending').length, 2)
assert.equal(hiem2026Booths.filter((booth) => booth.brand === 'E539').length, 0)
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'Ricky')?.booth, 'D39')
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'KELLY FU')?.hall, '5.1')
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'KELLY FU')?.booth, 'H33')
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'DEKAI')?.booth, 'D60')
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'QBH')?.booth, 'F20')
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'EASTERN')?.booth, 'C31')
assert.equal(hiem2026Booths.find((booth) => booth.brand === 'JES')?.booth, 'F67')
assert.deepEqual(boothSummary(hiem2026Booths), { confirmed: 26, pending: 2 })
console.log('HIEM 2026 booth source tests passed')
