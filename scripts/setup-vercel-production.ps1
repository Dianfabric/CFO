# Vercel Production 환경변수 자동 push
#
# 사용법 (PowerShell):
#   cd "C:\Users\freeh\OneDrive\Desktop\클로드 바이브코딩\CFO"
#   .\scripts\setup-vercel-production.ps1
#
# 처음 한 번만:
#   npx vercel link    (GitHub 로그인 인증)
#
# 이 스크립트는:
#   1. .env.local 의 Supabase 5개 변수를 Vercel production 에 push
#   2. Production 새 deploy 트리거
#
# 안전 — .env.local 값은 화면에 출력 안 됨 (vercel CLI 가 직접 받음)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "=== Vercel Production 환경변수 셋업 ===" -ForegroundColor Cyan
Write-Host ""

# 1. .vercel 폴더 확인 (link 됐는지)
if (-not (Test-Path ".vercel")) {
    Write-Host "⚠ Vercel 프로젝트 link 가 안 되어 있습니다." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "다음 명령을 먼저 실행해주세요:" -ForegroundColor Yellow
    Write-Host "  npx vercel link" -ForegroundColor White
    Write-Host ""
    Write-Host "Link 가 끝나면 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}

# 2. .env.local 확인
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ .env.local 파일이 없습니다." -ForegroundColor Red
    exit 1
}

# 3. push 할 변수 목록
$keys = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PROJECT_REF"
)

# 4. .env.local 파싱
$envContent = Get-Content ".env.local" -Raw

Write-Host "→ .env.local 에서 Supabase 변수 읽는 중..." -ForegroundColor Cyan
$found = 0
foreach ($key in $keys) {
    if ($envContent -match "(?m)^$([regex]::Escape($key))=(.+)$") {
        $found++
    }
}
Write-Host "  ${found}/${keys.Count} 발견" -ForegroundColor Green
Write-Host ""

if ($found -eq 0) {
    Write-Host "❌ .env.local 에 Supabase 변수가 하나도 없습니다." -ForegroundColor Red
    exit 1
}

# 5. 각 변수 push
foreach ($key in $keys) {
    if ($envContent -match "(?m)^$([regex]::Escape($key))=(.+)$") {
        $value = $matches[1].Trim()
        # 따옴표 제거 (가끔 .env 에 있음)
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'

        Write-Host "→ $key 추가/업데이트..." -ForegroundColor Cyan

        # 기존 값 제거 후 새로 추가 (force)
        & npx vercel env rm $key production --yes 2>&1 | Out-Null

        # 새 값 push (stdin 으로)
        $value | & npx vercel env add $key production 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ 성공" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ 실패 (수동 확인 필요)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "→ $key — .env.local 에 없음, 스킵" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Production 새 Deploy ===" -ForegroundColor Cyan
Write-Host ""
& npx vercel --prod

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✅ Vercel 환경변수 push 완료" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🔻 다음 단계 — Supabase SQL Editor 에서 한 번만 실행:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  INSERT INTO cycles (cycle_number, start_date, end_date, status)" -ForegroundColor White
Write-Host "  VALUES (1, CURRENT_DATE, CURRENT_DATE + 83, 'active');" -ForegroundColor White
Write-Host ""
Write-Host "Supabase 대시보드:" -ForegroundColor Yellow
Write-Host "  https://supabase.com/dashboard → dian-dash → SQL Editor" -ForegroundColor White
Write-Host ""
