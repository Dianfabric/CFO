# 로컬 개발 환경 설정 (v1.0 + v1.1)

> 클로드 코드 미리보기 / 로컬 dev 서버에서 v1.0 대시보드 + v1.1 신규 페이지를 모두 보면서 작업하는 방법.

## 한 번만 — 초기 셋업

### 1. v1.0 (Prisma + 로컬 SQLite) 셋업

```powershell
npm run db:local
```

이 한 줄이 다음을 수행합니다:
- `prisma/schema.local.prisma` (sqlite 변형) 기준으로 Prisma Client 재생성
- `prisma/dev.db` (SQLite 파일) 에 모든 v1.0 테이블 생성
- `.env` 의 `DATABASE_URL=file:./dev.db` 자동 인식

### 2. v1.1 (Supabase) 셋업

이미 `.env.local` 에 다음 키들이 있으면 OK:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

없으면 Supabase 대시보드 → Settings → API 에서 복사해 추가.

### 3. dev 서버 실행

```powershell
npm run dev
```

→ http://localhost:3000 접속

---

## 개발 흐름

### v1.0 페이지 (대시보드, 거래, 거래처 등)
- 루트 경로 `/` 부터 시작
- SQLite (`prisma/dev.db`) 사용 — 빈 DB 에서 시작
- 거래 등록 시 SQLite 에 저장됨
- 운영 데이터에 영향 없음 ✓

### v1.1 페이지 (`/finance/*`)
- 인증 필요 → `/login` 에서 로그인
- Supabase PostgreSQL 사용
- 운영 Supabase 와 같은 DB 공유

---

## 문제 해결

### 사이드바가 unstyled (Tailwind 미적용)
```powershell
# .next 캐시 손상 — 정리 후 재시작
Remove-Item -Recurse -Force .next
npm run dev
```

### Prisma 에러 (Unknown field, Table not exist 등)
```powershell
# Prisma Client 가 옛 schema 기준 — 재생성
npm run db:local
npm run dev
```

### dev 서버 종료가 어려울 때 (파일 잠김)
```powershell
# 서버 완전 종료 (PID 찾기)
Get-Process node | Stop-Process -Force
# 또는 작업 관리자 → node.exe 종료
```

---

## 운영 (Vercel) 과의 차이

| 항목 | 로컬 | 운영 (Vercel) |
|---|---|---|
| **v1.0 DB** | SQLite (`prisma/dev.db`) | PostgreSQL (Vercel Postgres) |
| **v1.1 DB** | Supabase (공유) | Supabase (공유) |
| **Prisma Schema** | `prisma/schema.local.prisma` (sqlite 변형) | `prisma/schema.prisma` (postgresql) |
| **v1.0 데이터** | 빈 상태 (개인 테스트용) | 실제 운영 데이터 |
| **인증** | Supabase 동일 | Supabase 동일 |

운영 빌드 시 Vercel 은 자동으로 `prisma generate` (postgresql 기준) 을 실행하므로
로컬의 sqlite 변형은 **운영에 영향 없음** ✓

---

## 파일 구조

```
prisma/
├── schema.prisma          ← 운영 (postgresql) — 절대 수정 금지
├── schema.local.prisma    ← 로컬 (sqlite 변형) — 자동 생성
├── dev.db                 ← 로컬 SQLite DB (개인 테스트용, gitignore)
└── dev.db.backup          ← 옛 dev.db 백업 (필요 시 복구)
```

---

## 통합 (Merger) 작업 시작 시

마인드맵 (`docs/mindmap/dian-cfo-merged.md`) 에 정리한 5개 카테고리 통합을 시작하면,
v1.0 의 Prisma 테이블도 Supabase 로 이전합니다 (CLAUDE.md 의 옵션 B).
그 시점부터는 로컬도 Supabase 단일 DB 로 통일됩니다.
