# 혼디가개 Frontend Foundation Spec

> 작성 목적: FE 착수 전에 **규약·에이전트·워크플로우 기반**을 백엔드와 같은 수준으로 세우기 위한 명세서.
> 이 문서는 4단계 워크플로우(Specify → Plan → Tasks → Decisions)의 **Specify 산출물**이다.
> 승인 후 §7 실행 순서에 따라 실제 파일을 생성하며, 생성이 끝나면 이 문서는 결정 기록으로 남는다.

---

## 0. 요약 (3줄)

- 백엔드는 **엔트리 문서 → `docs/*.md` 정본 → `.claude/skills/*`** 3층 규약 체계를 갖췄지만, 프론트엔드는 27줄 README가 전부다.
- 이 머신의 사용자 전역 에이전트 `~/.claude/agents/fe-*.md` 6종은 **다른 프로젝트(BossPickSeoul)를 가리킨 채 이 세션에서 활성**이다. 그대로 쓰면 없는 파일·없는 Swagger를 근거로 작업한다. → **최우선 차단 대상.**
- FE가 지금 필요한 것은 화면 코드가 아니라 **① 계약 정본 문서 ② 프로젝트 스코프 에이전트 ③ 착수 전 기능 선정 게이트**다.

---

## 1. 현황 진단

### 1-1. 백엔드 규약 체계 (모범 사례 — FE가 복제할 대상)

| 층     | 파일                                     | 역할                                                                                                                                                                                |
| ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 엔트리 | `backend/CLAUDE.md`, `backend/AGENTS.md` | 요약 + "정본은 `docs/`" 라고 위임만 한다 (30줄대)                                                                                                                                   |
| 정본   | `backend/docs/*.md` 18종                 | architecture / coding-conventions / api-design / external-api / entity-design / local-run / service-playbook / done-checklist / team-playbook / service-inventory / `services/*.md` |
| 자동화 | `.claude/skills/*` 7종                   | `backend-api-check`, `hexagonal-guard`, `backend-feature-bootstrap`, `backend-multi-agent`, `issue`, `pr`, `mr`                                                                     |
| 협업   | `backend/docs/team-playbook.md`          | Leader / Executor / DB Reviewer / Hexagonal Reviewer / Security Reviewer 역할 조합 + 요청 템플릿                                                                                    |

핵심 운영 원칙 3가지가 이미 문서화돼 있고, **FE도 그대로 승계한다.**

1. 엔트리 문서는 얇게, 세부 규칙은 `docs/`에 모은다.
2. 새 규칙이 생기면 엔트리보다 해당 `docs/*.md`를 먼저 갱신한다.
3. 코드 변경과 문서 변경은 같이 움직인다.

### 1-2. 프론트엔드 현황

```text
frontend/
└── README.md   (27줄: 예정 스택 3줄 + 화면 초안 7개 + 백엔드 연동 2줄)
```

- 규약 문서 0건, 에이전트 0건, 스킬 0건, 템플릿 0건, `package.json` 없음.
- 화면 초안은 **AI 기능 10종 후보 전체 기준**이라 무엇을 만들지 확정되지 않았다.

### 1-3. 즉시 위험 — 전역 FE 에이전트가 다른 프로젝트를 가리킨다

`~/.claude/agents/` 에 `fe-spec-writer` / `fe-implementer` / `fe-reviewer` / `fe-api-contract` / `fe-design-reviewer` / `fe-test-author` 6종이 있고, **모두 이 세션에서 호출 가능한 상태**다. 내용은 전부 BossPickSeoul 기준이다.

| 에이전트가 전제하는 것                                             | 혼디가개 실제                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| `https://api-dev.bosspickseoul.com/{service}/v3/api-docs`          | `http://localhost:8000/swagger-ui.html` (게이트웨이 집계) |
| `commercial-service` / `district-service` / `community-service`    | `auth` / `tour` / `plan` / `ai` / `batch`                 |
| `frontend/src/lib/api/client.ts`, `app/api/bff/[...path]/route.ts` | 없음 (미생성)                                             |
| `frontend/DESIGN.md`, `frontend/docs/engineering/*`                | 없음                                                      |
| `frontend/docs/features/**`, `frontend/_DocumentTemplates/`        | 없음                                                      |
| `frontend/docs/api/openapi/` 스냅샷                                | 없음                                                      |
| pnpm 전용, 워크트리별 포트                                         | 미정                                                      |
| "V1(NowDoBoss)→V2 이관 중" 잔재 탐색                               | 해당 없음 (신규 프로젝트)                                 |
| `backend/docs/api-reference.md`                                    | 없음 (실제 파일명은 `api-design-guide.md`)                |

**단, 버릴 자산이 아니다.** 혼디가개 백엔드는 BossPickSeoul auth-service 구조를 그대로 가져왔고(`service-inventory.md`), 공통 응답 래퍼 `Response<T>{dataHeader, dataBody}` 도 동일하다. 따라서 아래 규칙은 **그대로 이식 가능한 검증된 자산**이다.

- 토큰은 Next 서버만 보관 (`localStorage` 금지)
- `dataHeader.success` 판별 보존
- 에러 UI를 HTTP 상태로 분기 (404 = 데이터 부재, 재시도 버튼 금지 / 5xx = 일시 장애, 재시도 제공)
- nullable 섹션은 에러가 아니라 숨김
- 문자열 ID를 `number` 로 타이핑 금지
- `DESIGN.md` 를 토큰 단일 정본으로

→ **결론: 폐기가 아니라 "포팅". 프로젝트 스코프 `.claude/agents/` 로 동명 재정의해 전역판을 가린다.**

### 1-4. 루트 엔트리 문서 부재

`CLAUDE.md` / `AGENTS.md` 는 `backend/` 에만 있다. 저장소 루트에서 작업을 시작하거나 FE 파일만 건드리면 **프로젝트 규약이 컨텍스트에 로드되지 않는다.**

### 1-5. 그 외 갭

| 항목                         | 현재                                                           | 문제                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `.gitattributes`             | `working-tree-encoding=UTF-8` 이 `.java .kt .md .yml .yaml` 만 | `.ts .tsx .json .css` 누락 → Windows 팀원이 CP949 로 저장하면 한글 깨짐. `CLAUDE.md` 의 UTF-8 필수 규칙이 FE에서 강제되지 않음 |
| 커밋 prefix                  | `[BE]` `[DOCS]` `[INFRA]` 사용 중                              | `[FE]` 미정의                                                                                                                  |
| `/issue` `/pr` `/mr` 스킬    | description 예시가 `[BE] feat: ...` 하드코딩                   | FE 작업에서 잘못된 prefix 유도                                                                                                 |
| `.editorconfig`              | `.ts/.tsx` 2-space 이미 정의됨                                 | 문제 없음 (그대로 사용)                                                                                                        |
| 루트 `README.md` 저장소 구조 | `frontend/ 웹 프론트엔드` 한 줄                                | FE 문서 엔트리 링크 갱신 필요                                                                                                  |

---

## 2. 목표와 성공 기준

### 목표

FE 작업을 시작하는 누구나(사람·에이전트) **① 무엇을 만들지 ② 계약이 무엇인지 ③ 무엇을 지켜야 하는지 ④ 어떻게 검증하는지** 를 코드 한 줄 읽기 전에 문서에서 확정할 수 있게 한다.

### 성공 기준

- [ ] FE 파일을 건드리는 세션이 `frontend/CLAUDE.md` 를 자동 로드하고 `frontend/docs/` 정본으로 이어진다
- [ ] `/fe-*` 에이전트 호출 시 BossPickSeoul 경로·URL이 **한 건도** 등장하지 않는다
- [ ] API 필드·nullable·enum을 **추측으로 적은 명세가 0건** (전부 Swagger 실측 근거)
- [ ] 화면 하나를 "명세 → 구현 → 검증 → PR" 까지 문서만 보고 완주할 수 있다
- [ ] 미착수 백엔드 기능(적합도·후기·상담사 등)에 대한 화면이 **선정 전에는 만들어지지 않는다**

---

## 3. 백엔드 계약 실측 요약

> FE 문서가 참조할 근거. 아래는 코드 실측 기준이며, **최종 정본은 항상 실행 중 Swagger**다.

### 3-1. 진입점 / 포트

| 항목          | 값                                                                                   |
| ------------- | ------------------------------------------------------------------------------------ |
| 게이트웨이    | `http://localhost:8000` (dev `6000`, prod `9000`)                                    |
| 통합 Swagger  | `http://localhost:8000/swagger-ui.html`                                              |
| 라우팅 prefix | `/api/v1/{auth,members,places,walk-courses,emergencies,plans,ai-plans,assistant}/**` |
| 기동 순서     | service-discovery(8761) → auth(8081)/tour(8082)/plan(8083)/ai(8085) → gateway(8000)  |

**CORS**: 게이트웨이가 `http://localhost:3000`, `http://localhost:5173` 을 `allowCredentials=true` 로 이미 허용한다. 즉 브라우저 직접 호출도 기술적으로 가능하므로, BFF 경유 여부는 **의식적 결정**이어야 한다 (§6-1).

### 3-2. 공통 응답 래퍼

```ts
type Response<T> = {
  dataHeader: { success: boolean; resultCode: string | null; resultMessage: unknown | null }
  dataBody: T | null
}
```

- 성공: `{ dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody: T }`
- 실패: `{ dataHeader: { success: false, resultCode: "PET_001", resultMessage: "..." }, dataBody: null }`
- **`resultMessage` 는 `Object` 타입이다.** 문자열이 아닐 수 있다(Bean Validation은 필드별 맵을 담는다). FE 타입은 `unknown` 으로 받고 렌더 직전 정규화한다.

### 3-3. 에러 규약

| HTTP         | 의미                               | FE 처리                                       |
| ------------ | ---------------------------------- | --------------------------------------------- |
| 400          | 요청 검증 실패 (`*_1xx` 코드 대역) | 입력 수정 유도, 필드 매핑                     |
| 401          | 토큰 만료/무효                     | reissue 1회 → 실패 시 로그인 유도             |
| 404          | 데이터 부재 **또는 타인 리소스**   | 재시도 버튼 금지, `resultMessage` 그대로 노출 |
| 5xx / 무응답 | 일시 장애                          | 재시도 버튼 제공                              |

- `resultCode` 는 `{도메인}_{번호}` 문자열 (예: `PET_001`, `PET_100`). **번호 1xx 대역 = 요청 검증.**
- 백엔드는 타인 리소스 접근을 의도적으로 404 로 응답한다(존재 노출 차단). FE가 403 을 기대하면 안 된다.

### 3-4. 인증 흐름 (실측)

```text
[일반]  POST /api/v1/auth/login
        → body: { dataBody: { accessToken, memberId } }
        → header: Set-Cookie (refresh token, HttpOnly)

[소셜]  1) GET /api/v1/auth/{provider}/authorize  → { authorizationUrl }  ※ 서버 리다이렉트 아님
        2) 사용자를 authorizationUrl 로 보냄
        3) GET /api/v1/auth/{provider}/login?code=&state=  → 위와 동일 응답 + Set-Cookie

[재발급] POST /api/v1/auth/token/reissue   (refresh 쿠키를 읽음, body 없음)
[로그아웃] POST /api/v1/auth/logout        (인증 필요, refresh 쿠키 삭제)
[이메일] POST /api/v1/auth/email/send-code, /verify-code
```

FE 관점 결론 4개:

1. **소셜 로그인은 2-step API 흐름**이다. OAuth 리다이렉트를 백엔드가 처리해 주지 않는다.
2. refresh 는 **HttpOnly 쿠키**다 → 크로스 오리진에서 쓰려면 `credentials: 'include'` + 쿠키 도메인/`SameSite` 확인 필수.
3. `memberId` 는 **`String`** 이다. `number` 로 타이핑하지 않는다.
4. access token 은 body 로 온다 → **어디에 두는가가 §6-1 결정의 핵심.**

### 3-5. 페이지네이션

```ts
type SliceResponse<T> = { contents: T[]; hasNext: boolean }
```

커서 기반. 장소 목록·일정 목록이 이 형태 → **무한 스크롤이 기본 UI 패턴**이다.

### 3-6. 비동기 AI 작업

```text
POST /api/v1/ai-plans           → 202 Accepted + { jobId }   (캐시 히트 시 200 + 결과)
GET  /api/v1/ai-plans/jobs/{id} → 폴링
```

- 동일 사용자·동일 요청 in-flight 시 **기존 jobId 재사용(멱등)** → FE 중복 제출 방어는 있지만 UI에서도 막는다.
- **작업 실패는 HTTP 200 + `status=FAILED` + `errorCode/errorMessage`** 다. HTTP 5xx 가 아니다. → `success:true` 만 보고 성공 처리하면 실패를 놓친다.
- SSE(`/stream`)는 **설계만 있고 미구현**. 현재는 폴링만 가능.
- 결과 페이로드는 status별 nullable.

### 3-7. Enum metadata / XAI

```json
{ "suitabilityLevel": { "code": "HIGH", "name": "여행 적합", "description": "...", "scoreDescription": "..." } }
{ "score": 82, "reasons": [ { "code": "WEATHER_OK", "name": "기온 적정", "description": "현재 기온 24℃로 ..." } ] }
```

- 상태·등급·추천 이유는 **서버가 한국어 표시 문구까지 내려준다.**
- → **FE는 enum 코드로 한국어 레이블을 매핑하는 테이블을 만들지 않는다.** 서버 `name`/`description` 을 그대로 렌더한다. (이 규칙은 FE 컨벤션 문서에 명시)

### 3-8. 구현 / 미착수 매트릭스 (FE 착수 가능 범위)

| 백엔드 기능                   | 상태            | FE 착수                       |
| ----------------------------- | --------------- | ----------------------------- |
| 로그인·회원·반려견 프로필     | 구현            | **가능**                      |
| 장소 목록/상세 (`/places`)    | 구현            | **가능**                      |
| 여행 일정 CRUD (`/plans`)     | 구현            | **가능**                      |
| AI 일정 생성 (`/ai-plans`)    | 골격 (Stub LLM) | **가능** (실제 품질은 미보장) |
| 산책 코스 (두루누비)          | 미착수          | 대기                          |
| 여행 적합도·날씨·혼잡도       | 미착수          | 대기                          |
| 긴급 동물병원                 | 미착수          | 대기                          |
| 여행 후기 / 일정 공유         | 미착수          | 대기                          |
| AI 상담사·비서 (`/assistant`) | 미착수          | 대기                          |
| 성향 분석                     | 미착수          | 대기                          |

→ **지금 만들 수 있는 화면은 4개 영역**: 인증/회원, 반려견 프로필, 장소 탐색, 일정(+AI 생성). 나머지는 §6-3 기능 선정 후.

---

## 4. 산출물 명세 — 무엇을 추가로 작성하는가

### 4-1. 문서 계층 `frontend/docs/**`

백엔드 `docs/` 와 **1:1 대응**하게 짠다. 이미 검증된 구조이고, 팀이 문서 위치를 외우지 않아도 된다.

| 파일                                                  | 백엔드 대응            | 내용                                                                                                                                 |
| ----------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/README.md`                                      | `docs/README.md`       | 문서 목록 + 권장 읽기 순서 + 스킬 사용 예시                                                                                          |
| `docs/architecture-guide.md`                          | 동명                   | App Router 디렉터리 규약, server/client 컴포넌트 경계, 데이터 페칭 계층(`app` → `features` → `lib/api`), BFF 라우트 구조             |
| `docs/coding-conventions.md`                          | 동명                   | 네이밍, 파일 배치, import 순서, 타입 선언 위치, 금지 패턴(`any`, module-scope 브라우저 API), **서버 enum metadata 그대로 렌더 규칙** |
| `docs/api-integration-guide.md`                       | `api-design-guide.md`  | `Response<T>` 판별, `SliceResponse` 무한스크롤, 에러 HTTP 분기표, 비동기 job 폴링 패턴, React Query key 규약, invalidate 규칙        |
| `docs/auth-guide.md`                                  | (신설)                 | §3-4 흐름, 토큰 보관 위치, reissue 재시도 1회 규칙, 보호 경로 목록, 소셜 2-step 처리                                                 |
| `docs/styling-guide.md` + `DESIGN.md`                 | (신설)                 | `DESIGN.md` = 토큰 단일 정본(색/타이포/spacing 스케일/radius/shadow), `styling-guide.md` = 적용 규칙·공통 컴포넌트 목록              |
| `docs/external-api-guide.md`                          | 동명                   | 카카오 지도 SDK 로딩(SSR 회피), 키 관리, 지도 마커/경로 렌더 규약                                                                    |
| `docs/local-run-guide.md`                             | 동명                   | 패키지 매니저, dev 포트, 백엔드 동시 기동 절차, `.env.local` 항목, 자주 겪는 문제                                                    |
| `docs/testing-guide.md`                               | (신설)                 | 테스트 도구·환경 결정(§6-2), 무엇을 테스트하는가 우선순위                                                                            |
| `docs/done-checklist.md`                              | 동명                   | FE 완료 기준 (§4-5)                                                                                                                  |
| `docs/team-playbook.md`                               | 동명                   | FE 멀티 에이전트 역할 조합 + 요청 템플릿                                                                                             |
| `docs/screen-inventory.md`                            | `service-inventory.md` | 화면별 담당 API·상태(기획/구현/보류)·주의점 — **§3-8 매트릭스와 동기**                                                               |
| `docs/features/_index.md` + `features/<feature>/*.md` | `services/*.md`        | 기능별 명세 정본                                                                                                                     |
| `_DocumentTemplates/`                                 | (신설)                 | 공통명세(S0~~S5) / 세부명세(D0~~D8) / 테스트 케이스 템플릿                                                                           |
| `docs/api/openapi/`                                   | (신설)                 | Swagger 스냅샷 (참고용, **정본 아님** — 문서에 명시)                                                                                 |

### 4-2. 엔트리 문서

| 파일                        | 내용                                                                                                                                                       | 근거                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `CLAUDE.md` (루트, 신설)    | 저장소 전체 지도 + "백엔드 작업은 `backend/`, FE 작업은 `frontend/` 엔트리로" + 공통 규칙(UTF-8, 커밋 prefix `[BE]/[FE]/[DOCS]/[INFRA]`, 4단계 워크플로우) | §1-4 갭                  |
| `AGENTS.md` (루트, 신설)    | 위와 동일 내용의 에이전트용 사본                                                                                                                           | 백엔드 관행 승계         |
| `frontend/CLAUDE.md` (신설) | 30줄대 얇은 엔트리: 우선 확인 문서 목록 + 운영 원칙 + UTF-8 규칙                                                                                           | `backend/CLAUDE.md` 미러 |
| `frontend/AGENTS.md` (신설) | 동일                                                                                                                                                       | `backend/AGENTS.md` 미러 |
| `frontend/README.md` (갱신) | 확정 스택·문서 엔트리 링크로 교체. 화면 초안 7개는 `docs/screen-inventory.md` 로 이관                                                                      | 현재 초안 상태 해소      |

### 4-3. 프로젝트 스코프 에이전트 `.claude/agents/fe-*.md` 6종

전역판과 **동명으로 생성**해 프로젝트 스코프가 우선하게 한다. §1-3 표의 좌변을 우변으로 전부 치환하고, 아래를 반영한다.

| 에이전트             | 혼디가개 기준 핵심 변경                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fe-spec-writer`     | 정본 = `frontend/docs/features/**`, 템플릿 = `frontend/_DocumentTemplates/`, 계약 확인 = `http://localhost:8000/v3/api-docs` (게이트웨이 집계) / 서비스별 `localhost:{8081,8082,8083,8085}`, 근거 문서 = `backend/docs/api-design-guide.md` |
| `fe-implementer`     | 스택·패키지 매니저 §6 확정값, 규칙 정본 = `frontend/docs/*`, superpowers 스킬 연계 유지, **`Response<T>` 판별 + 404/5xx 분기 + 문자열 ID 규칙 유지**                                                                                        |
| `fe-reviewer`        | 체크리스트를 혼디가개 실사례로 교체 (V1 잔재 → **"미착수 백엔드 기능에 대한 상상 API 호출"**, `memberId: string`, 비동기 job `status=FAILED` 누락, enum 한국어 하드코딩)                                                                    |
| `fe-api-contract`    | 대조 대상 = 로컬 Swagger. **미기동 시 "확인 불가"로 보고하고 추측 금지** 를 명문화. 저장·수정·삭제 호출 금지 규칙 유지                                                                                                                      |
| `fe-design-reviewer` | 기준 = `frontend/DESIGN.md` + `docs/styling-guide.md`. 제품 톤 = 반려견 동반 여행(따뜻하되 과장 없음). 모바일 375 우선 유지                                                                                                                 |
| `fe-test-author`     | §6-2 테스트 방식 확정값으로 전면 교체 (BossPickSeoul 의 node+`renderToStaticMarkup` 방식을 그대로 쓸지 결정 필요)                                                                                                                           |

**추가 1종 (신설 권고)**

| 에이전트          | 역할                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fe-map-reviewer` | 카카오 지도 연동 전용 검토. SSR 회피, SDK 중복 로딩, 마커/오버레이 메모리 누수, effect cleanup, 좌표 정밀도, 키 노출 — 이 프로젝트에서 지도는 핵심이고 실수 유형이 고유하다 |

### 4-4. 스킬 `.claude/skills/*`

| 스킬                   | 역할                                                                                                              | 백엔드 대응                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `fe-feature-bootstrap` | 새 화면/기능 착수 — 화면 책임, 사용 API, 라우트, 컴포넌트 스켈레톤, 상태·에러·빈 상태 설계, 검증 계획을 묶어 제시 | `backend-feature-bootstrap` |
| `fe-api-check`         | FE 호출부 ↔ Swagger 계약 대조 점검                                                                                | `backend-api-check`         |
| `fe-boundary-guard`    | server/client 경계·데이터 페칭 계층 누수 점검                                                                     | `hexagonal-guard`           |
| `fe-multi-agent`       | 큰 FE 작업 역할 분리 실행                                                                                         | `backend-multi-agent`       |

**기존 스킬 갱신 3종**: `/issue`, `/pr`, `/mr` 의 description·예시에 `[FE]` prefix 추가.

### 4-5. `frontend/docs/done-checklist.md` (초안)

```text
1. 기능 단위
   - [ ] 명세(docs/features/**)와 구현이 일치한다
   - [ ] 호출하는 모든 엔드포인트가 Swagger에 실제로 존재한다
   - [ ] dataHeader.success 판별을 거친다
   - [ ] loading / empty / error(404) / error(5xx) 4개 상태가 각각 있고 시각적으로 구분된다
   - [ ] 404에 재시도 버튼이 없다
   - [ ] 비동기 job의 status=FAILED 를 실패로 처리한다
2. 타입·데이터
   - [ ] 문자열 ID를 string으로 타이핑했다 (memberId 등)
   - [ ] nullable 응답을 non-null로 가정하지 않는다
   - [ ] 서버 enum metadata(name/description)를 그대로 렌더한다
   - [ ] 단위(만원/℃/㎡)를 화면에 표기한다
3. 클라이언트 경계
   - [ ] module scope에서 window/document/storage에 접근하지 않는다
   - [ ] effect에 cleanup이 있다
   - [ ] SSR에서 깨지는 SDK(카카오 지도)는 ssr:false 로 로드한다
4. 보안
   - [ ] 토큰이 localStorage/sessionStorage에 없다
   - [ ] 카카오 JS 키 외 시크릿이 클라이언트 번들에 없다
5. 디자인·접근성
   - [ ] DESIGN.md 밖의 임의 색상/radius/shadow/spacing이 없다
   - [ ] 375 / 768 / desktop 에서 가로 스크롤·텍스트 오버플로가 없다
   - [ ] icon-only 버튼에 aria-label이 있고 focus style이 살아 있다
6. 검증·문서
   - [ ] lint / typecheck / test 통과
   - [ ] screen-inventory.md 상태 갱신
   - [ ] 공통 규칙이 바뀌었으면 frontend/docs/*.md 갱신
```

### 4-6. 인프라 규약 갱신

| 파일                               | 변경                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `.gitattributes`                   | `*.ts *.tsx *.json *.css *.scss` 에 `working-tree-encoding=UTF-8` 추가 (§1-5)                 |
| `.gitignore`                       | 이미 `frontend/node_modules`, `.next`, `out` 커버. 패키지 매니저 확정 후 lockfile 정책만 확인 |
| `.github/PULL_REQUEST_TEMPLATE.md` | "local ci test" 항목에 FE 검증 명령 병기                                                      |
| `.claude/launch.json`              | dev 서버 정의 추가 (`fe-design-reviewer` 의 `preview_start` 전제)                             |
| 루트 `README.md`                   | 저장소 구조 + 문서 엔트리에 `frontend/docs/README.md` 링크                                    |

---

## 5. 워크플로우 명세

### 5-1. 3중 규약의 결합 방식

이 저장소에는 3개의 규약 소스가 있고, **서로 충돌하지 않게 계층을 고정한다.**

| 소스                       | 성격                                                                                        | 우선순위                       |
| -------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| 전역 `~/.claude/CLAUDE.md` | 4단계 워크플로우 (Specify → Plan → Tasks → Decisions)                                       | 프로세스 골격                  |
| superpowers 플러그인       | brainstorming / writing-plans / TDD / systematic-debugging / verification-before-completion | 각 단계의 **실행 방법**        |
| 프로젝트 문서·에이전트     | 무엇이 정본인지, 무엇을 지켜야 하는지                                                       | **내용 판단은 항상 이쪽 우선** |

> 백엔드 문서는 superpowers를 언급하지 않고, BossPickSeoul `fe-implementer` 는 적극 활용한다.
> → **FE는 superpowers를 명시적으로 채택**하고, `frontend/docs/README.md` 에 이 결합 규칙을 적는다.

### 5-2. 단계 × 스킬 × 에이전트 매핑

| 단계          | 사용                                                                                                                         | 산출물                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Specify**   | `superpowers:brainstorming` → `/fe-feature-bootstrap` → `fe-spec-writer`                                                     | `frontend/docs/features/<feature>/*.md` |
| **Plan**      | `superpowers:writing-plans`, 필요 시 `fe-api-contract` 로 계약 선검증                                                        | 단계별 구현 계획                        |
| **Tasks**     | TodoWrite. 큰 작업은 `/fe-multi-agent`                                                                                       | 작업 목록                               |
| **구현**      | `fe-implementer` (+ `fe-test-author`)                                                                                        | 코드                                    |
| **검증**      | `fe-reviewer` + `fe-api-contract` + `fe-design-reviewer` (+ `fe-map-reviewer`), `superpowers:verification-before-completion` | 리뷰 보고                               |
| **Decisions** | `/issue` `/pr` `/mr`, `docs/*` 갱신                                                                                          | 커밋·PR·문서                            |

### 5-3. FE 멀티 에이전트 역할 조합 (`docs/team-playbook.md` 초안)

| 작업 유형        | 역할 조합                                                                              |
| ---------------- | -------------------------------------------------------------------------------------- |
| 단일 화면 추가   | Leader + `fe-implementer` + `fe-reviewer`                                              |
| 새 API 연동 포함 | + `fe-api-contract`                                                                    |
| 신규 디자인 섹션 | + `fe-design-reviewer`                                                                 |
| 지도/외부 SDK    | + `fe-map-reviewer`                                                                    |
| 인증 흐름 변경   | Leader + `fe-implementer` + `fe-reviewer` + `fe-api-contract` (auth-service 대조 필수) |

원칙은 백엔드와 동일: 작은 작업에 남용하지 않고, Reviewer가 구현하지 않고, 최종 책임은 메인 실행자에게 있다.

---

## 6. 아키텍처 결정 사항

> 각 항목은 **권고안 + 근거 + 대안**. 확정되면 §4 문서에 반영하고, 이 절은 결정 기록으로 남긴다.

### 6-1. BFF 경유 여부 — **권고: BFF 채택 (Next Route Handler 프록시)**

| 근거                              | 내용                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| access token 이 응답 body 로 온다 | 클라이언트에 두면 `localStorage`/메모리 어디든 XSS 노출면이 생긴다. BFF면 서버 세션 쿠키에 봉인 가능 |
| refresh 가 HttpOnly 쿠키다        | 크로스 오리진 쿠키(`SameSite`/도메인) 이슈를 BFF가 같은 오리진으로 흡수                              |
| 카카오 지도/외부 키               | 서버에서 주입·마스킹 가능                                                                            |
| 검증된 전례                       | BossPickSeoul 이 동일 백엔드 구조로 `/api/bff` catch-all 을 운영 중                                  |

- 대안(직접 호출): 게이트웨이 CORS가 `localhost:3000/5173` 을 이미 허용하므로 초기 속도는 빠르다. 단 토큰 보관 문제를 FE가 직접 떠안는다.
- **주의**: BFF 채택 시 게이트웨이 CORS 허용 목록에 **배포 웹 오리진**이 필요하다 (`ApiGatewayCorsConfig` 주석이 "POST만 403" 함정을 이미 경고한다). 배포 도메인 확정 시 BE 후속 요청 항목.

### 6-2. 스택 세부 — **권고**

| 항목            | 권고                                         | 비고                                                                                                                                                                           |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 프레임워크      | Next.js App Router + TypeScript              | `frontend/README.md` 기확정                                                                                                                                                    |
| 패키지 매니저   | **pnpm**                                     | BossPickSeoul 전례, 워크트리 다중 체크아웃에 유리                                                                                                                              |
| 서버 상태       | **React Query**                              | `SliceResponse` 무한스크롤 + AI job 폴링에 직결 (`useInfiniteQuery`, `refetchInterval`)                                                                                        |
| 클라이언트 상태 | **Zustand** (얕게)                           | 세션 파생값만                                                                                                                                                                  |
| 스타일링        | **결정 필요**                                | styled-components(전례) vs Tailwind(속도). 어느 쪽이든 `DESIGN.md` 토큰 정본은 동일                                                                                            |
| 테스트          | **결정 필요**                                | BossPickSeoul 의 `node` + `renderToStaticMarkup` 문자열 assertion 을 승계할지, jsdom + testing-library 를 도입할지. 승계는 설정 부담이 낮고, 도입은 상호작용 테스트가 가능하다 |
| 지도            | 카카오 지도 SDK, `dynamic(..., {ssr:false})` | `docs/external-api-guide.md`                                                                                                                                                   |

### 6-3. AI 기능 선정 — **가장 큰 선행 조건**

루트 `README.md` 는 AI 기능 10종을 후보로 두고 "핵심 몇 개만 선정" 이라고 명시했다. 미선정 상태에서 화면을 만들면 **버릴 코드를 만든다.**

- FE 기반 문서 작성은 선정 없이 진행 가능하다 (§7 Phase 0~1).
- 화면 구현은 §3-8 "착수 가능" 4개 영역부터 시작하되, **그 외 화면은 선정 확정 후.**
- 선정 결과는 루트 `README.md` 표의 상태 열과 `frontend/docs/screen-inventory.md` 에 동시 반영한다.

---

## 7. 실행 순서

| Phase                         | 작업                                                                                                                                                                                                                             | 산출물                                                                  | 선행 조건 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| **0. 차단** ✅                | 프로젝트 스코프 `.claude/agents/fe-*.md` **7종** 생성(전역판 가리기), 루트 `CLAUDE.md`/`AGENTS.md` 신설, `.gitattributes` 보강                                                                                                   | 오염된 에이전트 무력화                                                  | 완료      |
| **1. 규약** ✅                | `frontend/CLAUDE.md`/`AGENTS.md`, `docs/README.md`, `api-integration-guide.md`, `auth-guide.md`, `coding-conventions.md`, `architecture-guide.md`, `done-checklist.md`, `screen-inventory.md`, `_DocumentTemplates/`             | 계약·규칙 정본                                                          | 완료      |
| **2. 자동화** ✅              | 스킬 4종 신설 + `/issue` `/pr` `/mr` 에 `[FE]` 반영, `.claude/launch.json`, `docs/team-playbook.md`                                                                                                                              | 반복 경로 고정                                                          | 완료      |
| **2.5 도구 스펙** ✅          | `docs/tooling-guide.md` 신설, `testing-guide.md` 전면 보강(vitest.config·fixture 전략·TDD 범위·첫 테스트 10건), `architecture-guide.md` §7 App Router 상태 파일 규약, PR 템플릿 갱신                                             | 규약을 설정으로 강제하는 층                                             | 완료      |
| **2.6 선택 규칙** ✅          | `architecture-guide.md` §8~§10(전송 계층 2종·서버/클라 페칭 결정 트리+화면별 확정표·상태 소유권+searchParams 직렬화), `api-integration-guide.md` §7(전역 기본값·도메인별 staleTime 표준값·invalidate), `component-guide.md` 신설 | **"둘 다 가능할 때 무엇을 고르는가"** — lint·리뷰로 못 잡는 불일치 차단 | 완료      |
| **3. 프로젝트 부트스트랩** ✅ | Next.js 프로젝트 생성, `DESIGN.md` + `styling-guide.md`, `lib/api` 계층, BFF 라우트, 인증 파이프라인, `local-run-guide.md`                                                                                                       | 첫 화면 착수 가능                                                       | Phase 1~2 |
| **4. 첫 화면**                | §3-8 착수 가능 4개 영역 중 하나를 명세→구현→검증 완주해 **워크플로우 실증**                                                                                                                                                      | 규약 검증 완료                                                          | Phase 3   |

Phase 4 를 끝낸 뒤 **문서·에이전트·체크리스트를 실제로 겪은 문제 기준으로 1회 개정**한다. 백엔드 운영 원칙 "새 규칙이 생기면 `docs/*.md` 를 먼저 갱신한다" 를 그대로 적용한다.

---

## 8. 결정 기록 (2026-08-26 확정)

| #   | 항목             | 확정                                                                     | 근거                                                                                                                             | 반영 위치                                    |
| --- | ---------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | BFF 경유         | **BFF 프록시 채택** (`/api/bff` catch-all)                               | access token이 응답 body, refresh가 HttpOnly 쿠키 → 클라이언트 보관 시 XSS 노출면 + 크로스 오리진 쿠키 문제                      | `docs/architecture-guide.md` §5              |
| 2   | 패키지 매니저    | **pnpm**                                                                 | 워크트리 다중 체크아웃, 디스크 효율                                                                                              | `docs/architecture-guide.md` §1              |
| 3   | 스타일링         | **Tailwind CSS**                                                         | App Router/RSC 마찰 0, 런타임 0. styled-components는 모든 스타일 컴포넌트에 `"use client"` 를 강제해 서버 컴포넌트 이점을 잃는다 | `docs/architecture-guide.md` §1, `DESIGN.md` |
| 4   | 서버/클라 상태   | **React Query + Zustand**                                                | `SliceResponse` 무한 스크롤(`useInfiniteQuery`) + AI job 폴링(`refetchInterval`)에 직결. 클라 상태는 세션 파생값만               | `docs/api-integration-guide.md` §7           |
| 5   | 테스트 방식      | **Vitest `environment: node`** + `renderToStaticMarkup` 문자열 assertion | 설정 부담 최소. 순수 로직은 `src/lib/**` 함수 테스트 우선. 상호작용 테스트 필요 시 jsdom 추가 도입하고 문서 갱신                 | `docs/testing-guide.md`                      |
| 6   | 전역 FE 에이전트 | **프로젝트 스코프 동명 재정의로 가리기**                                 | 다른 프로젝트(BossPickSeoul)를 깨지 않는다. 검증된 규칙(토큰 서버 보관, 404/5xx 분기, 문자열 ID)은 이식                          | `.claude/agents/fe-*.md` 7종                 |
| 7   | AI 진행 표시     | **폴링**                                                                 | SSE는 백엔드 미구현(설계만 존재)                                                                                                 | `docs/api-integration-guide.md` §5           |

### 미확정 (외부 결정 대기)

| #   | 항목                                             | 상태                     | 영향                                                                                                 |
| --- | ------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| A   | **AI 기능 선정** (10종 후보 중 N개)              | **대기 — 최우선**        | 화면 범위를 정한다. 선정 전에는 `docs/screen-inventory.md` "착수 가능" 4개 영역만 구현               |
| B   | 배포 웹 오리진                                   | 대기                     | 확정 시 게이트웨이 `ApiGatewayCorsConfig` 허용 목록 등록 (BE 후속 요청). 미등록 시 **POST만 빈 403** |
| C   | 카카오 콘솔 허용 도메인 / 소셜 콜백 redirect URI | 대기                     | 등록 주체·값 확정 필요 (`docs/external-api-guide.md`)                                                |
| D   | refresh 쿠키 `SameSite`/`Domain`/만료 실측값     | 대기                     | 백엔드 기동 후 응답 헤더 실측해 `docs/auth-guide.md` 에 기록                                         |
| E   | 디자인 토큰 확정                                 | 1차안 적용 중            | `DESIGN.md` 는 1차 토큰 세트. 디자이너 확정 시 갱신                                                  |
| F   | **폼 규약** (`docs/form-guide.md`)               | Phase 3 중 작성 예정     | 라이브러리 결정 + **백엔드 400 `resultMessage` 필드별 오류 → 폼 필드 매핑** + 제출 중 중복 방지      |
| G   | **문구 상수화** (`src/lib/messages/`)            | 첫 화면과 함께 작성 예정 | "다시 시도"/"재시도" 갈림 방지. 서버 문구는 그대로 쓰므로 FE 생성 문구만 대상                        |

## 9. 이 명세서의 완료 기준

- [x] §6 결정 7건이 확정되고 이 문서에 결과가 기록된다 (§8)
- [x] §7 Phase 0 이 완료돼 오염된 에이전트가 더 이상 호출되지 않는다
- [x] §4 산출물 목록이 전부 생성된다 (Phase 0~2). 단, `docs/api/openapi/` 스냅샷은 백엔드 기동 후 생성 — Phase 3으로 이월
- [x] 규약 중 기계로 강제 가능한 항목이 설정 스펙으로 확정된다 (`docs/tooling-guide.md` §1 매핑표)
- [x] Phase 3 프로젝트 부트스트랩 — Next.js 16 / React 19 / Tailwind 4 / React Query 5 / Zustand 5 / Vitest 4,
      설정 파일 실물(lint 규칙 8종 발화 검증 완료), BFF·세션 파이프라인, 테스트 92개
- [ ] Phase 4 첫 화면 (장소 목록) — `docs/screen-inventory.md` §3
- [ ] Phase 4 첫 화면이 `done-checklist.md` 전 항목을 통과한다

### Phase 0~2 산출물 (2026-08-26)

| 구분        | 파일                                                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 루트 엔트리 | `CLAUDE.md`, `AGENTS.md`, `README.md`(갱신)                                                                                                                                                                                                                                                  |
| FE 엔트리   | `frontend/CLAUDE.md`, `frontend/AGENTS.md`, `frontend/README.md`(전면 교체)                                                                                                                                                                                                                  |
| FE 규약     | `docs/README.md`, `architecture-guide.md`, `coding-conventions.md`, `api-integration-guide.md`, `auth-guide.md`, `styling-guide.md`, `external-api-guide.md`, `testing-guide.md`, `local-run-guide.md`, `done-checklist.md`, `team-playbook.md`, `screen-inventory.md`, `features/_index.md` |
| 디자인      | `frontend/DESIGN.md` (1차 토큰 세트)                                                                                                                                                                                                                                                         |
| 템플릿      | `_DocumentTemplates/` 3종 (공통명세 S0~~S5 / 세부명세 D0~~D9 / 테스트 케이스)                                                                                                                                                                                                                |
| 에이전트    | `.claude/agents/fe-{spec-writer,implementer,test-author,reviewer,api-contract,design-reviewer,map-reviewer}.md`                                                                                                                                                                              |
| 스킬        | `.claude/skills/fe-{feature-bootstrap,api-check,boundary-guard,multi-agent}/SKILL.md`, `issue`/`pr`/`mr` 갱신                                                                                                                                                                                |
| 도구 스펙   | `docs/tooling-guide.md` — ESLint flat config / Prettier / tsconfig strict / env 검증 / `next.config` remotePatterns / git 훅 / CI                                                                                                                                                            |
| 선택 규칙   | `docs/component-guide.md` 신설 + `architecture-guide.md` §8~§10 + `api-integration-guide.md` §7                                                                                                                                                                                              |
| 인프라      | `.gitattributes`(ts/tsx/json/css UTF-8 강제), `.claude/launch.json`, `.github/PULL_REQUEST_TEMPLATE.md`(FE 검증 명령·제목 규칙)                                                                                                                                                              |

검증: 상대 링크 전수 해석 확인, BossPickSeoul 잔재 0건, BOM 0건.

### Phase 3 산출물 (2026-08-26)

| 구분          | 내용                                                                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 스택          | Next.js 16.3.3 / React 19.2.8 / TypeScript 5.9.3 / Tailwind 4.3.3 / React Query 5.102 / Zustand 5.0 / Vitest 4.1                                                                                                                                                                 |
| 설정          | `package.json`(스크립트 12종) `tsconfig.json`(strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`) `eslint.config.mjs` `.prettierrc.json` `vitest.config.mts` `next.config.ts` `postcss.config.mjs` `.nvmrc` `.env.example` `.gitignore` |
| 전송 계층     | `src/lib/api/{client,server,paths,response,error,slice}.ts` — 브라우저는 `/api/bff`, 서버는 게이트웨이 직접                                                                                                                                                                      |
| BFF           | `app/api/bff/[...path]/route.ts` — 토큰 주입 / **응답 body 에서 토큰 제거** / refresh 쿠키 봉인 / 401 재발급 1회                                                                                                                                                                 |
| 세션          | `src/lib/auth/{session,session-crypto,refresh-cookie,reissue,cookie-names}.ts` — AES-256-GCM 봉인                                                                                                                                                                                |
| 순수 로직     | `src/lib/{ai-plan/job, format/*, geo/coord, url/place-filters, query/query-client}.ts`                                                                                                                                                                                           |
| 디자인 바인딩 | `src/styles/tokens.css` + `app/globals.css` `@theme`                                                                                                                                                                                                                             |
| 테스트        | 10개 파일 **92개 테스트** + `src/test/{api,fixtures/place,stubs}`                                                                                                                                                                                                                |
| CI            | `.github/workflows/frontend-ci.yml` — format/lint/typecheck/test/build                                                                                                                                                                                                           |

**게이트 통과**: `pnpm lint` / `pnpm typecheck` / `pnpm test`(92) / `pnpm format:check` / `pnpm build`

### Phase 3 에서 확정된 계약 사실 (문서 정정 포함)

| #   | 발견                                                                                                                     | 조치                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 백엔드가 좌표를 **`lat`/`lng` Double 로 정규화**해 내려준다. TourAPI 원본 `mapx`/`mapy` 문자열이 아니다                  | `external-api-guide` `testing-guide` `screen-inventory` `local-run-guide` `done-checklist` `fe-map-reviewer` `fe-test-author` **정정** |
| 2   | refresh 쿠키가 `SameSite=Strict` + `Path=/api/v1/auth/token/reissue`                                                     | BFF 서버측 보관이 필수임을 `auth-guide` §8 에 확정 기록 (미결 D 해소)                                                                  |
| 3   | `placeId` 는 응답에서 **String** (백엔드 내부는 long, Snowflake 크기)                                                    | `types/place.ts` 및 `screen-inventory` 반영                                                                                            |
| 4   | place 목록 필터는 `areaCode` `sigunguCode` `contentType` `petAllowanceType` `lastPlaceId` `size`(1~50) — **전부 단일값** | `screen-inventory` 에 확정 기록                                                                                                        |
| 5   | `contentType`/`petAllowanceType` 응답이 metadata 객체                                                                    | enum 매핑 테이블 금지 규칙이 실제 계약으로 확인됨                                                                                      |
