import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('/Users/dian/CFO/src/app/api/exhibition/booths/route.ts', 'utf8')

assert.match(source, /const isCustom = input\.isCustom \?\? input\.boothId\.startsWith\('custom-'\)/)
assert.match(source, /create:[\s\S]*boothCode: input\.boothCode\.trim\(\)\.toUpperCase\(\), isCustom,/)
assert.match(source, /update:[\s\S]*boothCode: input\.boothCode\.trim\(\)\.toUpperCase\(\), isCustom,/)
assert.doesNotMatch(source, /isCustom: Boolean\(input\.isCustom\)/)

console.log('Exhibition custom booth route preserves custom cards')
