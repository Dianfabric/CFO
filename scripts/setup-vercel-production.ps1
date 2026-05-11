# Vercel Production 환경변수 자동 push (V2)
#
# 사용법:
#   cd "C:\Users\freeh\OneDrive\Desktop\클로드 바이브코딩\CFO"
#   .\scripts\setup-vercel-production.ps1
#
# 처음 한 번만:  npx vercel link

# 스크립트가 한 에러로 중단되지 않도록 Continue
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "=== Vercel Production env push ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".vercel")) {
    Write-Host "ERROR: 'npx vercel link' 먼저 실행하세요." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path ".env.local")) {
    Write-Host "ERROR: .env.local 파일이 없습니다." -ForegroundColor Red
    exit 1
}

# push 할 변수 (Supabase + Gemini)
$keys = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PROJECT_REF",
    "GOOGLE_GENAI_API_KEY",
    "GEMINI_MODEL",
    "IMAGEN_MODEL"
)

# .env.local 한 줄씩 파싱
$envLines = Get-Content ".env.local"
$envMap = @{}
foreach ($line in $envLines) {
    if ($line -match "^([A-Z_][A-Z0-9_]*)=(.+)$") {
        $envMap[$matches[1]] = $matches[2].Trim('"').Trim("'")
    }
}

# 각 키 push (없으면 add, 있으면 rm 후 add)
foreach ($key in $keys) {
    if (-not $envMap.ContainsKey($key)) {
        Write-Host "  SKIP $key (.env.local 에 없음)" -ForegroundColor DarkGray
        continue
    }
    $value = $envMap[$key]
    if ($value -match "^PASTE_" -or [string]::IsNullOrWhiteSpace($value)) {
        Write-Host "  SKIP $key (placeholder)" -ForegroundColor DarkGray
        continue
    }

    Write-Host "  --> $key" -ForegroundColor Cyan

    # 1. 기존 값 제거 시도 (없으면 무시)
    cmd /c "echo y | npx vercel env rm $key production 2>nul" | Out-Null

    # 2. 새 값 push
    $value | cmd /c "npx vercel env add $key production 2>&1" | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "      OK" -ForegroundColor Green
    } else {
        Write-Host "      FAILED (수동 확인)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Production 새 deploy ===" -ForegroundColor Cyan
Write-Host ""
& npx vercel --prod

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "OK: 완료. Vercel 빌드 1-3분 후 확인." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계 - https://dian-cfo.vercel.app/finance/cycle 새로고침" -ForegroundColor Yellow
Write-Host "'12주 사이클 시작하기' 버튼 클릭 -> 끝" -ForegroundColor Yellow
Write-Host ""
