# Frontend Local Run Guide

> 백엔드 기동 절차는 `backend/docs/local-run-guide.md`.
> 도구 설정의 근거와 적용 편차는 `tooling-guide.md`.

## 1. 사전 준비

- Node.js 20 이상
- pnpm (`npm i -g pnpm`)
- 백엔드 기동 (장소·일정·인증 API를 쓰는 화면은 백엔드가 필요하다)

## 2. 설치 / 기동

```bash
cd frontend
pnpm install
pnpm dev            # http://localhost:3000
```

`3000` 은 관례일 뿐이고 **필수가 아니다.** 브라우저는 항상 Next 서버(같은 오리진)와만 통신하고,
게이트웨이 호출은 BFF가 서버에서 수행하므로 `Origin` 헤더가 붙지 않는다 → 게이트웨이 CORS 검사 대상이 아니다.
포트가 점유돼 있으면 `pnpm dev:alt`(5174)나 임의 포트를 써도 된다.

> 게이트웨이 CORS 허용 목록(로컬 출처는 `localhost:5174` 하나뿐)이 의미를 갖는 경우는
> **브라우저가 게이트웨이를 직접 부를 때**다 (WebSocket 핸드셰이크, Swagger UI 등).
> BFF 경유 요청에는 적용되지 않는다.

## 3. 명령

| 명령                 | 용도                                |
| -------------------- | ----------------------------------- |
| `pnpm dev`           | 개발 서버 (`http://localhost:3000`) |
| `pnpm build`         | 프로덕션 빌드                       |
| `pnpm lint`          | ESLint                              |
| `pnpm lint:fix`      | ESLint 자동 수정                    |
| `pnpm typecheck`     | `tsc --noEmit`                      |
| `pnpm format`        | Prettier 적용                       |
| `pnpm format:check`  | Prettier 검사                       |
| `pnpm test`          | Vitest 1회 실행                     |
| `pnpm test:watch`    | Vitest 감시 모드                    |
| `pnpm test:coverage` | 커버리지 리포트                     |
| `pnpm verify`        | `lint && typecheck && test`         |

**커밋 전 게이트**: `pnpm verify && pnpm format:check`

## 4. 백엔드 동시 기동

FE 화면을 실제로 확인하려면 게이트웨이까지 떠 있어야 한다.

```bash
cd backend
docker compose -f docker-compose-local.yml up -d       # MySQL / Redis / MinIO

./gradlew :cloud:service-discovery:bootRun             # 8761
./gradlew :service:auth-service:bootRun                # 8081
./gradlew :service:tour-service:bootRun                # 8082
./gradlew :service:plan-service:bootRun                # 8083
./gradlew :service:ai-service:bootRun                  # 8085
./gradlew :cloud:api-gateway:bootRun                   # 8000
```

기동 순서: **service-discovery → 나머지 서비스 → api-gateway**

| 화면               | 필요한 서비스                            |
| ------------------ | ---------------------------------------- |
| 로그인·회원·반려견 | discovery + auth + gateway               |
| 장소 탐색          | discovery + tour + gateway               |
| 여행 일정          | discovery + auth + tour + plan + gateway |
| AI 일정 생성       | 위 + ai                                  |

**장소 데이터가 비어 있으면** batch-service로 적재해야 한다. `TOUR_API_SERVICE_KEY` 환경변수가 필요하다 (`backend/docs/local-run-guide.md` §6).

## 5. `.env.local`

`.env*` 는 `.gitignore` 대상이다. **커밋하지 않는다.** `.env.example` 만 커밋한다.

`.env.example` 을 복사해 시작한다. 값이 없거나 형식이 틀리면 **부팅 시점에 즉시 실패**한다
(`src/lib/env.server.ts` / `env.client.ts` 의 zod 스키마).

```bash
# 백엔드 게이트웨이 (BFF가 서버에서만 사용 — NEXT_PUBLIC_ 아님)
BACKEND_BASE_URL=http://localhost:8000

# 서버 세션 암호화 키
SESSION_SECRET=<32자 이상 임의 문자열>

# 카카오 지도 JavaScript 앱 키 (클라이언트 노출)
NEXT_PUBLIC_KAKAO_MAP_KEY=<JS 앱 키>
```

**`NEXT_PUBLIC_` 접두사는 클라이언트 번들에 박힌다.** `BACKEND_BASE_URL`, `SESSION_SECRET` 에는 절대 붙이지 않는다.

### 백엔드 없이 화면 보기 — `MOCK_API=true`

`MOCK_API=true` 면 게이트웨이 없이 화면이 뜬다 (프로덕션 빌드에서는 항상 비활성).
보호 화면(`/plans` · `/pets` · `/mypage`)은 로그인해야 보이므로 **fixture 계정으로 로그인한다.**

| 이메일                | 비밀번호       |
| --------------------- | -------------- |
| `demo@hondigagae.dev` | `password123!` |

`src/lib/api/mock/store.ts` 의 `createStore()` 에 하드코딩된 in-memory fixture 다 —
실제 계정이 아니고 `MOCK_API=true` 일 때만 존재한다. 반려견 2마리와 일정 4건이 함께 들어 있다.

**스토어에 필드를 추가했다면 개발 서버를 다시 띄우지 않아도 된다.** 상태는 HMR 을 넘어
`globalThis` 에 살아남지만, `mockStore()` 가 모양이 어긋난 상태를 버리고 새로 만든다.

#### AI 일정 생성 — 시나리오를 골라서 본다

`/ai-plans/new` 의 **`하고 싶은 여행` 칸에 낱말을 넣어 시나리오를 고른다.** mock 이
무작위로 갈리면 화면 분기를 확인할 수 없어 트리거를 낱말로 뒀다 (명세 S9-8).

| 요청 메모에 넣는 낱말 | 결과                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| (없음)                | `COMPLETED` — 여행 일수만큼 초안이 나온다                                |
| `실패`                | `FAILED` — **HTTP 200 + `status=FAILED`** + `AIPLAN_012` 실패 화면       |
| `일부`                | `COMPLETED` 인데 **마지막 하루가 빈다** — "N일 중 M일만 만들었어요" 안내 |

상태는 **조회 횟수로 진행한다**: 1회 `PENDING` → 2회 `RUNNING` → 3회부터 결과.
폴링이 2초라 6초쯤이면 결과에 닿는다.

**작업이 진행되지 않으면 탭이 비활성인지 본다.** React Query 는 탭이 숨겨지면
`refetchInterval` 을 멈춘다 (명세 S4 가 의도한 동작이다). 브라우저 프리뷰 페인이
hidden 이면 `document.hidden === true` 라 같은 현상이 나는데 **제품 결함이 아니다.**

## 6. Swagger 확인

계약을 확인할 때는 문서가 아니라 실제 Swagger를 본다.

```bash
open http://localhost:8000/swagger-ui.html

curl -s --max-time 10 http://localhost:8000/v3/api-docs | python3 -m json.tool --no-ensure-ascii | head -60
curl -s --max-time 10 http://localhost:8082/v3/api-docs   # tour-service
```

## 7. 자주 겪는 문제

- **화면은 보이는데 버튼이 하나도 안 눌린다 / 목록이 계속 스켈레톤이다** — 하이드레이션이 죽은 것이다.
  Next dev 서버는 `/_next/*` 에 대한 **cross-origin 요청을 기본 차단**한다. `localhost` 가 아닌
  호스트(`127.0.0.1`, LAN IP, 다른 기기)로 접근하면 JS 청크가 **403** 이 되는데, SSR HTML 은
  정상이라 겉보기엔 멀쩡하다. 콘솔에 `403 Forbidden` 이 보이거나 dev 로그에
  `Blocked cross-origin request to Next.js dev resource` 가 있으면 이 경우다.
  → `localhost` 로 접근하거나 `next.config.ts` 의 `allowedDevOrigins` 에 해당 호스트를 추가한다.
- **다른 앱이 보인다 / 내 변경이 반영되지 않는다** — 3000 포트가 이미 다른 로컬 앱에 점유된 것이다.
  `next dev -p 3000` 은 이 경우 조용히 실패하지 않고 뜨지만, `localhost:3000` 요청이 먼저 바인딩된
  앱으로 갈 수 있다. `lsof -nP -iTCP:3000 -sTCP:LISTEN` 으로 확인하고 `pnpm dev:alt`(5174)를 쓴다.
  BFF 경유라 FE 포트는 게이트웨이 CORS 와 무관하다. 게이트웨이를 직접 부르는 경우에만 `5174` 여야 한다 — 허용된 로컬 출처가 그것뿐이다.
- **조회는 되는데 등록만 빈 403** — 브라우저가 게이트웨이를 **직접** 부르고 있고, 그 오리진이 CORS 허용 목록에 없다. 브라우저는 POST에 `Origin` 을 붙이고 GET에는 붙이지 않아 "조회만 되는" 형태로 나타난다. BFF를 우회하는 호출부가 있는지 먼저 확인하고, 정말 직접 호출이 필요하면 `ApiGatewayCorsConfig` 에 오리진 추가를 BE에 요청한다.
- **로그인 직후 401** — refresh 쿠키의 `SameSite`/도메인 문제. BFF 경유가 아니라 게이트웨이를 직접 부르고 있는지 확인한다.
- **지도가 빈 회색 박스** — ① `NEXT_PUBLIC_KAKAO_MAP_KEY` 누락 ② 카카오 콘솔에 `http://localhost:3000` 미등록 ③ `ssr:false` 누락. 브라우저 콘솔을 먼저 본다.
- **지도가 바다 한가운데** — `LatLng(위도, 경도)` 순서. `lat` 이 먼저다. `src/lib/geo/coord.ts` 의 `toLatLng()` 을 쓴다 (`external-api-guide.md`).
- **장소 목록이 항상 비어 있음** — 백엔드는 떴지만 batch로 데이터를 적재하지 않았다.
- **AI 일정이 항상 같은 결과** — 정상이다. 현재 `StubLlmAdapter` 고정 샘플이다 (`backend/docs/service-inventory.md`).
- **`jwtDecoder` NPE로 백엔드 기동 실패** — FE 문제가 아니다. `backend/docs/local-run-guide.md` §7.
