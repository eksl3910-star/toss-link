# ably-link-server

에이블리 링크 교환 서비스 — Next.js 15 + Cloudflare Pages + D1

## 로컬 개발

```bash
pnpm install
pnpm dev
```

## D1 데이터베이스 설정

### Pages에 D1 연결 (필수 — 회원가입/DB 오류 방지)

GitHub Actions로 배포해도 **`wrangler.toml`만으로는 Pages 런타임에 D1이 붙지 않습니다.** 대시보드에서 꼭 연결하세요.

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 프로젝트 **`ably-link-server`**
2. **Settings** → **Functions** → **D1 database bindings**
3. **Add binding**
   - **Variable name**: `DB` ← 코드와 반드시 동일
   - **D1 database**: `ably-link-db` (또는 사용 중인 DB)
4. **Production**과 **Preview** 탭(또는 환경) **둘 다** 같은 바인딩이 있는지 확인
5. 저장 후 **재배포** (빈 커밋 push 또는 Actions 다시 실행)

### 스키마 / wrangler

1. Cloudflare Dashboard에서 D1 데이터베이스 생성
2. `wrangler.toml`의 `database_id` 업데이트
3. 마이그레이션 실행:

```bash
npx wrangler d1 execute ably-link-db --local --file=./migrations/0001_schema.sql
# 기존 DB에 `users.email` 컬럼이 있으면 닉네임 컬럼으로 이름만 변경:
npx wrangler d1 execute ably-link-db --remote --file=./migrations/0002_users_nickname.sql
```

회원가입·로그인은 **이메일이 아니라 닉네임**(영어·한글·숫자, 2~20자)으로 합니다.

- **기존 DB**에 `users.email` 컬럼이 남아 있을 때만 `0002_users_nickname.sql`을 **한 번** 실행하세요.
- **새로** 현재 버전의 `0001_schema.sql`로 만든 DB는 처음부터 `nickname` 컬럼이라 `0002`는 실행하지 마세요. (`email` 컬럼이 없으면 `ALTER RENAME`이 실패합니다.)

## 환경 변수 (Cloudflare Pages > Settings > Environment Variables)

| 변수 | 설명 |
|------|------|
| `ADMIN_TOGGLE_PASS` | **`/admin` 화면에 입력하는 관리자 비밀번호** (점검·통계 API 검증). 최우선으로 사용 |
| `ADMIN_BASIC_PASS` | `ADMIN_TOGGLE_PASS`가 없을 때 위와 동일 용도로 사용 |
| `ADMIN_BASIC_USER` | (선택) 예전 Basic Auth용. **현재 미들웨어에서는 사용하지 않음** |

`/admin`은 브라우저 Basic Auth 없이 열립니다. **반드시 긴 `ADMIN_TOGGLE_PASS`를 설정**하고, 화면의 「관리자 비밀번호」에 그 값을 입력하세요. (Basic Auth 이중 인증은 `fetch`가 헤더를 안 붙여 무한 로그인 창이 나는 문제가 있어 제거했습니다.)

## 배포

GitHub `main` 브랜치에 push하면 GitHub Actions가 자동 배포합니다.

필요한 GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 프로젝트 구조

```
app/
  (auth)/login/       로그인/회원가입 페이지
  (main)/             홈 (링크 올리기/받기)
  admin/              관리자 대시보드
  maintenance/        점검 안내 페이지
  api/auth/           인증 API (register, login, logout, me, delete)
  api/links/          링크 API (submit, claim, consume, return, requeue, stats)
  api/admin/          관리자 API (maintenance, stats)
  api/settings/       설정 조회 API
lib/
  constants.ts        상수 정의
  password.ts         PBKDF2 해싱 + 타이밍 안전 비교
  session.ts          세션 쿠키 관리
  database.ts         D1 쿼리 함수 전체
migrations/
  0001_schema.sql          DB 스키마 (users.nickname)
  0002_users_nickname.sql  기존 DB용: email 컬럼 → nickname 이름 변경
middleware.ts         세션·점검 모드 등 (관리자는 페이지 내 비밀번호로 검증)
```
