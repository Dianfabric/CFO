import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const outDir = '/tmp/dian-cfo-exhibition-photo-upload-test-dist'
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

execFileSync('npx', [
  'tsc', 'src/lib/exhibition-photo-upload.ts', '--target', 'ES2022', '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext', '--skipLibCheck', '--outDir', outDir,
], { cwd: '/Users/dian/CFO', stdio: 'inherit' })
assert.equal(existsSync(`${outDir}/exhibition-photo-upload.js`), true)

const { uploadSequentially } = await import(`file://${outDir}/exhibition-photo-upload.js`)
const started = []
const progress = []
let active = 0
let maxActive = 0
const uploaded = await uploadSequentially(['one', 'two', 'three'], async (photo) => {
  started.push(photo)
  active += 1
  maxActive = Math.max(maxActive, active)
  await new Promise((resolve) => setTimeout(resolve, 5))
  active -= 1
  return `saved-${photo}`
}, (items) => progress.push([...items]))

assert.deepEqual(uploaded, ['saved-one', 'saved-two', 'saved-three'])
assert.deepEqual(started, ['one', 'two', 'three'])
assert.deepEqual(progress, [['saved-one'], ['saved-one', 'saved-two'], ['saved-one', 'saved-two', 'saved-three']])
assert.equal(maxActive, 1, 'multiple images must upload one at a time')
console.log('Exhibition multi-photo sequential upload test passed')
