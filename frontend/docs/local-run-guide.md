# Frontend Local Run Guide

> 백엔드 기동 절차는 `backend/docs/local-run-guide.md`.
> 도구 설정의 근거와 적용 편차는 `tooling-guide.md`.

## 1. 사전 준비

- Node.js **20.19 이상** (`.nvmrc` 의 `20` 이 곧 최신 20.x 다). 20.10 같은 구버전에서는 `pnpm verify` 가 막힌다 — 하한의 근거는 `docs/tooling-guide.md` §2
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
BACKEND_API_URL=http://localhost:8000

# 서버 세션 암호화 키
AUTH_SESSION_SECRET=<32자 이상 임의 문자열>

# 카카오 지도 JavaScript 앱 키 (클라이언트 노출)
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=<JS 앱 키>
```

**`NEXT_PUBLIC_` 접두사는 클라이언트 번들에 박힌다.** `BACKEND_API_URL`, `AUTH_SESSION_SECRET` 에는 절대 붙이지 않는다.

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

| 요청 메모에 넣는 낱말 | 결과                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| (없음)                | `COMPLETED` — 여행 일수만큼 초안이 나온다                                                     |
| `실패`                | `FAILED` — **HTTP 200 + `status=FAILED`** + `AIPLAN_012` 실패 화면                            |
| `시간초과`            | `FAILED` — `AIPLAN_006` 실패 화면. 단서가 지역이 아니라 **기간**으로 갈린다 (#710)            |
| `일부`                | `COMPLETED` 인데 **마지막 하루가 빈다** — "N일 중 M일만 만들었어요" 안내                      |
| `사라진`              | 첫 항목이 **원천에 없는 장소**다 — 담기가 `PLAN_004` 로 막히고 "빼고 담기" 복구 경로가 열린다 |

상태 진행 방식은 **두 경로가 다르다** (#91).

| 경로                               | 진행 방식                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SSE 구독 (`.../stream`) — **기본** | **시간이 끌고 간다**: 구독 즉시 스냅샷 → 0.6초 간격으로 **단계 4개** → 3초 결과. 워커 역할을 시간이 대신한다 |
| 폴링 (`GET .../jobs/{id}`) — 폴백  | **조회 횟수로 진행한다**: 1회 `PENDING` → 2회 `RUNNING` → 3회부터 결과. 2초 간격이라 6초쯤이면 결과에 닿는다 |

**`n / m단계` 가 움직이는 것은 SSE 로만 볼 수 있다** (#250). 백엔드가 단계 경계마다 이벤트를
올려 잡당 2회였던 것이 6회가 됐고 mock 도 그 모양이다 — 폴링으로 내려앉으면 `RUNNING` 조회가
한 번뿐이라 1단계에서 결과로 건너뛴다.

#### 그만두기(작업 취소)를 로컬에서 보는 법 (#250)

대기 화면의 `그만두기` 를 누르면 `POST /ai-plans/jobs/{jobId}/cancel` 이 나가고 화면이
**취소 화면**으로 바뀐다 — 실패 화면이 아니다(`errorCode` 가 비어 온다).

| 해 볼 것                     | 보이는 것                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| 대기 중에 `그만두기`         | `만들기를 그만뒀어요` + `같은 조건으로 다시 만들기` · `조건 바꾸기`           |
| 취소 후 `같은 조건으로 다시` | **새 `jobId`** 가 나온다 — 취소가 멱등 키를 함께 풀어 준다                    |
| 결과가 나온 뒤 취소 (curl)   | **409 `AIPLAN_019`** — 화면은 오류를 띄우지 않고 다시 조회해 결과를 보여 준다 |
| 취소한 작업을 새로고침       | `CANCELED` 에 머문다. 조회를 더 해도 완료로 살아나지 않는다                   |

```bash
curl -X POST -b cookies.txt http://localhost:5174/api/bff/ai-plans/jobs/{jobId}/cancel
```

**스트림을 한 번 열면 작업은 종결까지 간 것으로 본다.** RUNNING 에서 화면을 떠났다가
새로고침하면 결과가 바로 보인다 — 실제 작업도 보는 사람이 없어도 백그라운드에서 끝난다.

스트림이 실제로 통과하는지 확인하려면 프레임 도착 시각을 본다. **전부 같은 시각에 오면
버퍼링되고 있다는 뜻이다**:

```bash
curl -N -b cookies.txt -H 'Accept: text/event-stream' http://localhost:5174/api/bff/ai-plans/jobs/{jobId}/stream
```

**작업이 진행되지 않으면 탭이 비활성인지 본다.** React Query 는 탭이 숨겨지면
`refetchInterval` 을 멈춘다 (명세 S4 가 의도한 동작이다). 브라우저 프리뷰 페인이
hidden 이면 `document.hidden === true` 라 같은 현상이 나는데 **제품 결함이 아니다.**
**SSE 구독은 탭 가시성과 무관하게 계속 흐른다** — 폴백으로 내려앉았을 때만 이 현상이 보인다.

#### 골든타임의 다섯 갈래를 보는 법 (#262 · [#270](https://github.com/8llow8llowMe/hondigagae/issues/270))

판정 자리의 상태는 넷이고 그중 `NO_FORECAST` 는 이유가 둘이라 **로컬에서 봐야 할 화면이
다섯**이다. 그런데 넷은 **실데이터로 만들기 어렵다** — 밤 늦게만(`DAY_ENDED`, #204 가 dev
23:17 KST 에 관측), 날씨 원천이 죽어야(`UNAVAILABLE`), 경보가 떠야(`SUPPRESSED_BY_WARNING`),
경보 없이 하루가 전부 위험이어야(`ALL_HOURS_RISKY`) 나온다.

mock 은 자유 입력이 없어(AI 일정의 요청 메모 같은 것) **반려견 조건 셋으로 갈래를 낸다.**

| 더위 | 추위 | 소리 | 화면                                        | 여는 법                        |
| ---- | ---- | ---- | ------------------------------------------- | ------------------------------ |
| —    | —    | —    | `18:00 – 21:00 안전`                        | **반려견 없음**(게스트·미등록) |
| ✅   | ❌   | ✅   | `경보가 발효 중이라 추천하지 않아요` + 곡선 | **몽실이** (기본)              |
| ✅   | ❌   | ❌   | `오늘은 나가지 않는 편이 좋아요` (위험 톤)  | 몽실이의 `소리 민감` 해제      |
| ❌   | ✅   | —    | `18:00 – 21:00 안전`                        | **초코** (기본)                |
| ❌   | ❌   | —    | `남은 예보 없음` — **정상**, 재시도 없음    | 초코의 `추위 민감` 해제        |
| ✅   | ✅   | —    | `날씨 정보 없음` + **다시 시도**            | 몽실이에 `추위 민감` 추가      |

`/pets/{petId}` 편집 화면에서 체크 한 번이면 갈린다. **조합 자체는 임의다** — 반려견 조건이
실제로 커버리지나 경보를 바꾸지는 않는다. `mockWalkTimes` 머리주석에 그 사실을 적어 뒀다.

**둘째·셋째 줄이 서로 다른 문구여야 한다.** 경보 날은 곡선에 안전 구간이 남아 있어도
**보류**이고, 위험 단정은 경보 없이 전부 위험일 때만 참이다 — 그 어긋남이 #270 의 제보였다.

**문구는 mock 이 짓지 않는다.** 서버 `ForecastCoverage`·`GoldenWindowStatus` 의
`name`/`description` 을 그대로 옮겼다. 다만 **판정 자리의 제목·설명은 FE 문구다**
(`goldenSuppressed` 등) — 상태마다 톤 규칙이 다르고 서버 문장은 합니다체 두 문장이라 이
자리에 맞지 않는다. `NoForecast` 만 서버 문구를 쓴다(이유가 넷이라 FE 표를 만들면 그것이
곧 매핑 테이블이 된다).

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
- **지도가 빈 회색 박스** — ① `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` 누락 ② 카카오 콘솔에 `http://localhost:3000` 미등록 ③ `ssr:false` 누락. 브라우저 콘솔을 먼저 본다.
- **지도가 바다 한가운데** — `LatLng(위도, 경도)` 순서. `lat` 이 먼저다. `src/lib/geo/coord.ts` 의 `toLatLng()` 을 쓴다 (`external-api-guide.md`).
- **장소 목록이 항상 비어 있음** — 백엔드는 떴지만 batch로 데이터를 적재하지 않았다.
- **AI 일정 생성이 타임아웃으로 실패** — 로컬 백엔드에 Ollama 가 없어서다. 스텁 어댑터는 없으므로(2026-09-03 제거) `BACKEND_API_URL` 을 dev 서버로 돌려 확인한다.
- **`jwtDecoder` NPE로 백엔드 기동 실패** — FE 문제가 아니다. `backend/docs/local-run-guide.md` §7.
