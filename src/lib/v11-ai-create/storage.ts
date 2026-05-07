/**
 * AI Create — runs 파일시스템 저장소
 *
 * 모든 산출물은 `docs/ai-create/runs/<run_id>/` 폴더에 JSON 으로 저장.
 * 파일 규칙:
 *   00-product-brief.json
 *   01-section-plan.json
 *   02-copy-deck.json
 *   03-image-prompts.json   (Phase 2)
 *   04-render-bundle.html   (Phase 2)
 *   05-review-report.json   (Phase 2)
 *   _meta.json              (RunMeta — 상태·타임스탬프)
 *
 * 서버 전용 — Server Component / Server Action / Route Handler 에서만 사용.
 */
import 'server-only'
import { promises as fs } from 'fs'
import path from 'path'
import type {
  ProductBrief,
  SectionPlan,
  CopyDeck,
  ImagePromptDeck,
  ReviewReport,
  RunMeta,
  RunStatus,
  DianTier,
  DianDivision,
} from './types'

const RUNS_ROOT = path.join(process.cwd(), 'docs', 'ai-create', 'runs')

function runDir(runId: string) {
  return path.join(RUNS_ROOT, runId)
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function writeJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ============================================================
// run_id 생성
// ============================================================

export function makeRunId(productName: string, tier: DianTier): string {
  // YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10)
  // 상품명을 슬러그화
  const slug = productName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\w\s-가-힣]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30)
  // 짧은 랜덤 (충돌 회피)
  const rand = Math.random().toString(36).slice(2, 6)
  return `run_${today}_${slug || 'product'}_${tier}_${rand}`
}

// ============================================================
// RunMeta — 런 상태 인덱스
// ============================================================

export async function readRunMeta(runId: string): Promise<RunMeta | null> {
  return readJson<RunMeta>(path.join(runDir(runId), '_meta.json'))
}

export async function writeRunMeta(meta: RunMeta) {
  meta.updated_at = new Date().toISOString()
  await writeJson(path.join(runDir(meta.run_id), '_meta.json'), meta)
}

export async function updateRunStatus(
  runId: string,
  status: RunStatus,
  patch?: Partial<RunMeta>,
) {
  const current = await readRunMeta(runId)
  if (!current) throw new Error(`Run not found: ${runId}`)
  const next: RunMeta = {
    ...current,
    ...patch,
    status,
    updated_at: new Date().toISOString(),
  }
  await writeRunMeta(next)
}

export async function appendArtifact(runId: string, fileStem: string) {
  const current = await readRunMeta(runId)
  if (!current) return
  if (!current.artifacts.includes(fileStem)) {
    current.artifacts = [...current.artifacts, fileStem]
    await writeRunMeta(current)
  }
}

// ============================================================
// 산출물 read / write
// ============================================================

export async function writeProductBrief(brief: ProductBrief) {
  const fp = path.join(runDir(brief.run_id), '00-product-brief.json')
  await writeJson(fp, brief)
  await appendArtifact(brief.run_id, '00-product-brief')
}

export async function readProductBrief(runId: string): Promise<ProductBrief | null> {
  return readJson<ProductBrief>(path.join(runDir(runId), '00-product-brief.json'))
}

export async function writeSectionPlan(runId: string, plan: SectionPlan) {
  await writeJson(path.join(runDir(runId), '01-section-plan.json'), plan)
  await appendArtifact(runId, '01-section-plan')
}

export async function readSectionPlan(runId: string): Promise<SectionPlan | null> {
  return readJson<SectionPlan>(path.join(runDir(runId), '01-section-plan.json'))
}

export async function writeCopyDeck(runId: string, deck: CopyDeck) {
  await writeJson(path.join(runDir(runId), '02-copy-deck.json'), deck)
  await appendArtifact(runId, '02-copy-deck')
}

export async function readCopyDeck(runId: string): Promise<CopyDeck | null> {
  return readJson<CopyDeck>(path.join(runDir(runId), '02-copy-deck.json'))
}

export async function writeImagePromptDeck(runId: string, deck: ImagePromptDeck) {
  await writeJson(path.join(runDir(runId), '03-image-prompts.json'), deck)
  await appendArtifact(runId, '03-image-prompts')
}

export async function readImagePromptDeck(runId: string): Promise<ImagePromptDeck | null> {
  return readJson<ImagePromptDeck>(path.join(runDir(runId), '03-image-prompts.json'))
}

export async function writeReviewReport(runId: string, report: ReviewReport) {
  await writeJson(path.join(runDir(runId), '05-review-report.json'), report)
  await appendArtifact(runId, '05-review-report')
}

export async function readReviewReport(runId: string): Promise<ReviewReport | null> {
  return readJson<ReviewReport>(path.join(runDir(runId), '05-review-report.json'))
}

// ============================================================
// 런 목록 — Hub 페이지에서 표시
// ============================================================

export interface RunSummary {
  run_id: string
  product_name: string
  target_tier: DianTier
  target_division: DianDivision
  status: RunStatus
  artifacts: string[]
  created_at: string
  updated_at: string
  error?: string
  /** UI 정렬용 */
  _sort_key: number
}

export async function listRuns(): Promise<RunSummary[]> {
  try {
    await ensureDir(RUNS_ROOT)
    const entries = await fs.readdir(RUNS_ROOT, { withFileTypes: true })
    const runs: RunSummary[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('_')) continue // _test 등 스킵
      if (!entry.name.startsWith('run_')) continue

      const meta = await readRunMeta(entry.name)
      if (meta) {
        runs.push({
          run_id: meta.run_id,
          product_name: meta.product_name,
          target_tier: meta.target_tier,
          target_division: meta.target_division,
          status: meta.status,
          artifacts: meta.artifacts,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          error: meta.error,
          _sort_key: new Date(meta.updated_at).getTime(),
        })
      } else {
        // 메타 파일이 없는 레거시 런 — brief 에서 안전하게 추론
        const brief = await readProductBrief(entry.name)
        if (brief && brief.product_name && brief.target_tier && brief.target_division) {
          const stat = await fs.stat(path.join(RUNS_ROOT, entry.name))
          const createdAt =
            (brief._meta && brief._meta.created_at) ?? stat.mtime.toISOString()
          runs.push({
            run_id: brief.run_id ?? entry.name,
            product_name: brief.product_name,
            target_tier: brief.target_tier,
            target_division: brief.target_division,
            status: 'done',
            artifacts: ['00-product-brief'],
            created_at: createdAt,
            updated_at: stat.mtime.toISOString(),
            _sort_key: stat.mtimeMs,
          })
        }
      }
    }
    // 최신순 정렬
    runs.sort((a, b) => b._sort_key - a._sort_key)
    return runs
  } catch (err) {
    console.error('listRuns error', err)
    return []
  }
}
