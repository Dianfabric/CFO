import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('/Users/dian/CFO/src/components/exhibition/Hiem2026Planner.tsx', 'utf8')

assert.match(source, /aria-label="모바일 현장 기록 창"/)
assert.match(source, /fixed inset-0/)
assert.match(source, /onClose=\{\(\) => setSelectedId\(null\)\}/)
assert.match(source, /notes\[booth\.id\]\?\.status/)
assert.match(source, /미팅 완료/)
assert.match(source, /grid-cols-3/)
assert.match(source, /overflow-x-auto/)
assert.match(source, /sm:grid-cols-2/)
assert.match(source, /2026 상하이 INTERTEXTILE/)
console.log('HIEM mobile detail drawer source test passed')
