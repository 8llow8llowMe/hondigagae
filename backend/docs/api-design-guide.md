# Backend API Design Guide

## 1. RESTful 경로 원칙

- 리소스 컬렉션명은 복수형을 기본으로 사용한다.
- 경로는 상위 리소스부터 하위 리소스 순으로 깊이를 표현한다.
- `plans`, `places`, `pets`, `walk-courses`처럼 도메인 의미가 드러나는 이름을 사용한다.
- 비교/요약/분석 API도 가능하면 리소스 체인 안에서 의미가 드러나도록 구성한다.
  - 예: `GET /api/v1/places/{placeId}/suitability` (장소 여행 적합도)
  - 예: `GET /api/v1/members/me/pets/{petId}/preferences` (반려견 성향 분석 결과)

## 2. 응답 구조 원칙

- 공통 응답 래퍼는 `Response<T>`를 사용한다.
- Controller 반환은 `ResponseEntity<Response<T>>`로 통일한다.
- 중첩 응답은 `Response`, `Item`, `Presenter` 조합으로 구성한다.
- 내부용 `Info`를 외부 응답 타입으로 직접 노출하지 않는다.
- **성공 응답의 `dataBody` 는 `null` 일 수 있다.** `Response.success(null)` 은 `common-core` 가 허용하는 정상 응답이다.

### 2-0. 부재는 언제 200 + `dataBody: null` 이고 언제 404 인가 (이슈 [#979](https://github.com/8llow8llowMe/hondigagae/issues/979))

- **선택적 하위 리소스(부모당 0~1개)의 부재는 200 + `dataBody: null`** 이다. "아직 없음" 은 오류가 아니라 정상 상태다.
  예: `GET /api/v1/plans/{planId}/share-link`(공유 중이 아님), `GET /api/v1/plans/{planId}/reviews`(아직 안 씀).
  404 로 답하면 화면을 열 때마다 브라우저 콘솔에 "Failed to load resource" 가 찍히고, 클라이언트가 404 를 "없음" 으로
  접으면서 **일정 자체가 없는 404 까지 같이 삼킨다.**
- **id 로 지정한 리소스 자체의 부재·타인 리소스는 404** 다 — 위 예에서도 일정이 없거나 남의 것이면 `PLAN_001` 404 다.
  Facade 첫 줄의 소유 확인이 하위 리소스 조회보다 먼저 선다.
- **존재 노출을 막아야 하는 곳은 404 를 유지한다.** 공개 토큰 조회(`GET /api/v1/shared-plans/{token}`)가 그렇다 —
  없음·폐기·비공유를 같은 `PLAN_023` 404 로 답해야 토큰을 찍어 보는 쪽에 "있었다" 를 흘리지 않는다.
- **수정할 대상이 있어야 하는 쓰기는 404 를 유지한다.** `PUT /plans/{planId}/reviews` 의 `PLAN_015` 가 그렇다.
- 구현 모양: Processor 는 `Optional<Info>` 를 돌려주고, Facade 가 `.map(presenter::toX).orElse(null)` 로 푼다.
  `*WebUseCase` 의 반환 javadoc 에 **null 일 수 있음**을 적고, `@Operation` description 에 "없으면 200 + `dataBody: null`" 을 쓴다.

### 2-1. 오류 봉투 계약 — `resultMessage` 는 항상 문자열이다 (이슈 [#491](https://github.com/8llow8llowMe/hondigagae/issues/491))

`dataHeader` 의 칸마다 타입이 **하나씩만** 있다. 오류 종류에 따라 타입이 갈리지 않는다.

| 필드 | 타입 | 값 |
|------|------|-----|
| `success` | `boolean` | 성공 여부 |
| `resultCode` | `string \| null` | 대표 오류 코드. 성공이면 `null` |
| `resultMessage` | `string \| null` | **사용자에게 보여줄 대표 메시지.** 성공이면 `null` |
| `fieldErrors` | `ValidationErrorItem[] \| null` | 필드 단위 검증 오류. **검증 실패가 아니면 `null`** |

`ValidationErrorItem` 은 `{ code, field, message }` 다.

```json
// 일반 오류 — fieldErrors 가 null
{"dataHeader":{"success":false,"resultCode":"PLAN_001",
  "resultMessage":"존재하지 않는 여행 일정입니다.","fieldErrors":null}}

// 검증 오류 — resultMessage 는 그대로 문자열이고, 필드 정보만 fieldErrors 에 더해진다
{"dataHeader":{"success":false,"resultCode":"PLACE_102",
  "resultMessage":"size는 50 이하만 가능합니다.",
  "fieldErrors":[{"code":"PLACE_102","field":"size","message":"size는 50 이하만 가능합니다."}]}}
```

**왜 한 칸에 두 타입을 태우지 않는가** — 예전에는 `resultMessage` 가 `Object` 라서 Bean Validation
실패만 `{message, errors}` 객체가 실렸다. 클라이언트는 `typeof === 'string'` 으로 분기할 수밖에
없었고, **검증 오류에서만 서버가 준 문구를 통째로 버리고** `API 오류 (status 400)` 같은 대체
문구를 보여줬다. 정확한 안내를 만들어 놓고 타입 때문에 못 쓰는 구조였다.

구현 규칙은 아래 셋이다.

- **`Response.fail(code, message)`** 는 메시지를 `String` 으로만 받는다. 객체를 넘길 방법이 없다.
- 필드 오류를 함께 실을 때는 **`Response.fail(code, message, fieldErrors)`** 를 쓴다.
- 핸들러가 이 조합을 직접 만들지 않는다. `common-core` 의 **`ValidationErrorSupport`** 가 유일한
  생산자이고, 도메인 `*ExceptionHandler` 는 거기에 위임한다 (`coding-conventions.md` §검증 오류).

`resultMessage` 는 **대표 오류 하나의 메시지**다. 여러 필드가 틀렸을 때 이를 이어 붙이지 않는다 —
전체 목록은 `fieldErrors` 에 있고, 화면은 입력 항목별로 해당 `field` 의 첫 오류를 붙이면 된다.

### 2-2. 게이트웨이도 같은 봉투를 낸다 (이슈 [#529](https://github.com/8llow8llowMe/hondigagae/issues/529))

**봉투 계약의 경계는 서비스가 아니라 클라이언트가 받는 응답 전부다.** 요청이 서비스까지
가지 못하고 게이트웨이에서 끝나도 응답 모양은 같아야 한다 — 클라이언트는 어디서 끊겼는지
모르고, 알 필요도 없다.

- **api-gateway 의 JWT 거부는 `Response.fail` 봉투로 나간다.** 게이트웨이는 이미 `common-core` 를
  의존하므로 봉투 DTO 를 그대로 쓴다.
- **WebFlux 라 `@ControllerAdvice` 가 아니다.** `WebExceptionHandler` 를 `@Order(-2)` 로 등록한다
  (`JwtAuthExceptionWebHandler`). **`ErrorWebExceptionHandler` 타입으로 올리면 안 된다** — 부트의
  `ErrorWebFluxAutoConfiguration` 이 기본 핸들러를
  `@ConditionalOnMissingBean(ErrorWebExceptionHandler.class)` 로 걸어서, 그 타입으로 빈을 올리는
  순간 **JWT 와 무관한 모든 오류의 기본 처리까지 사라진다.** 상위 타입으로 등록하고 내 것이
  아닌 예외는 그대로 다시 던져 기본 핸들러에게 넘긴다. `-2` 인 이유는 기본 핸들러가 `-1` 이라서다.
- **인증 오류 코드는 `SECURITY_00x` 하나로 통일한다.** 같은 만료 토큰이 auth-service(nginx 직결)
  로 가면 `SECURITY_002`, 게이트웨이를 거치면 다른 코드로 올 이유가 없다 — 사용자에게 일어난
  일은 하나다. **프론트가 코드로 분기하므로 두 체계가 섞이면 분기를 두 벌 갖게 된다.**
  게이트웨이는 서블릿 스택을 끌고 오는 security-core 를 의존하지 않으므로 코드 문자열을
  복사해 두고, 어긋남은 테스트가 소스를 대조해 막는다 (`JwtErrorCodeContractTest`).
- **상태 코드는 사유마다 다르다.** 만료·형식 오류·서명 불일치·폐기는 `401`, 검증 불가(Redis 장애)는
  `503` 이다. 전부 `500` 으로 접으면 두 가지가 깨진다 — 프론트 BFF 가 **401 일 때만** 재발급을
  시도하므로 세션이 스스로 복구되지 못하고, 의도한 실패가 진짜 장애와 구분되지 않는다.

```json
// 게이트웨이가 만료 토큰을 거부한 응답 — 서비스의 401 과 같은 모양, 같은 코드다
{"dataHeader":{"success":false,"resultCode":"SECURITY_002",
  "resultMessage":"토큰이 만료되었습니다.","fieldErrors":null},"dataBody":null}
```

**토큰이 없는 요청은 거부하지 않는다.** 게이트웨이는 그대로 통과시키고 인증 판정은 서비스가
한다 — 공개 API(`/places` 등)가 미로그인으로도 200 이어야 하기 때문이다.

**레이트 리밋 거부도 같은 봉투다** (이슈 [#1244](https://github.com/8llow8llowMe/hondigagae/issues/1244)). 지금은 공유 링크
공개 경로(`GET /api/v1/shared-plans/{token}`)에만 걸려 있고, 한도를 넘으면 `429` + `GATEWAY_001` 이다.

- **게이트웨이 고유 사유는 `GATEWAY_00x` 다** (`GatewayErrorCode`). 서비스에 대응이 없는 사유라 `SECURITY_00x` 사본인
  `JwtErrorCode` 에 섞지 않는다.
- **SCG 기본 `RequestRateLimiter` 를 쓰지 않는다.** 거부를 **빈 본문**의 429 로 끝내 봉투 계약을 깬다. 판정은 같은
  `RedisRateLimiter` 에 맡기고 거부 응답만 봉투로 쓰는 `SharedPlanRateLimit` 필터(`SharedPlanRateLimitGatewayFilterFactory`)를
  건다 — `RateLimitRouteCoverageTest` 가 세 프로파일에서 기본 필터가 없음을 고정한다. 이 필터는 공유 토큰 전용 키
  리졸버에 묶여 있어 **다른 라우트에 걸면 판정 없이 통과한다** — 다른 경로의 리밋은 별도 리졸버·팩토리로 만든다.
- 허용·거부 모두 `X-RateLimit-Remaining`·`X-RateLimit-Replenish-Rate`·`X-RateLimit-Burst-Capacity`·`X-RateLimit-Requested-Tokens`
  헤더를 싣는다. Redis 장애로 판정을 못 하면 통과시키고 `X-RateLimit-Remaining` 이 `-1` 이다.

```json
// 공유 링크 하나에 요청이 몰려 게이트웨이가 거부한 응답
{"dataHeader":{"success":false,"resultCode":"GATEWAY_001",
  "resultMessage":"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.","fieldErrors":null},"dataBody":null}
```

## 3. Controller 스타일

- 다른 레이어를 직접 호출하지 않고 `WebUseCase`만 호출한다.
- 가능하면 아래 흐름을 유지한다.

```java
SomeResponse response = someWebUseCase.getSomething(...);
return ResponseEntity.ok().body(Response.success(response));
```

## 4. 계층 흐름

- `Controller -> WebUseCase -> WebFacade -> Processor -> Port/Adapter`
- `Info -> Presenter -> Response`
- write 흐름은 도메인 중심으로 유지하고, read 흐름은 QueryResult/Info 중심으로 유지한다.

## 5. 정렬 / 페이지네이션

- 단순 페이지보다 무한 스크롤이 맞는 영역은 `SliceResponse`를 우선 사용한다. (예: 장소 목록, 후기 목록)
- 정렬은 enum 기반 RequestParam을 우선 사용한다.
  - 예: `sortType`, `orderType`
- enum을 쓰면 Swagger에서 허용값을 명확하게 보여줄 수 있다.

### 5-1. `totalCount` 는 총계여야 한다 (이슈 [#285](https://github.com/8llow8llowMe/hondigagae/issues/285))

커서 대신 **상위 N 개**를 돌려주는 조회(`/emergencies/facilities`, `/places/nearby`)에서
Presenter 가 `totalCount(items.size())` 로 채우면 **이름만 총계인 값**이 나간다. 목록은 이미
`size` 로 잘려 있어 두 값이 언제나 같아지고, 클라이언트가 `items.length < totalCount` 로
잘림을 판정하면 그 조건이 **늘 거짓**이 된다 — 잘린 목록에서 센 개수가 전체인 양 화면에 나간다.

**규칙**

- `totalCount` 는 **자르기 전** 개수다. Presenter 는 항목을 세지 말고 Processor 가 센 값을 받는다.
- 그래서 Processor 는 목록과 총계를 **함께 든 Info** 를 돌려준다 (`NearbyFacilitiesInfo`,
  `NearbyPlacesInfo`). `List<XxxInfo>` 만 넘기면 총계를 담을 자리가 없어 Presenter 가 다시 센다.
- 자를 일이 없는 목록(즐겨찾기, 반려견 목록처럼 전량을 주는 조회)은 `items.size()` 가 곧 총계라
  그대로 둔다. **`size` 파라미터가 있으면 이 규칙의 대상이다.**
- 총계를 셀 수 있는 근거는 포트에 있다 — 위 두 조회는 사각 범위 전량을 가져와 메모리에서
  거른다. DB `LIMIT` 으로 옮기는 순간 총계는 별도 count 질의가 필요하다.

## 6. 보안 API 설계

- 인증 사용자 전용 API는 `@PreAuthorize`를 명시한다.
- member 식별은 JWT claim을 기준으로 처리한다.
- 클라이언트가 임의 헤더로 member 식별값을 주입하는 방식은 사용하지 않는다.
- **선택적 인증** — 공개 API지만 로그인 사용자를 식별하고 싶으면 `@PreAuthorize` 없이
  `@AuthenticationPrincipal MemberLoginActive`를 null 허용으로 받아 분기한다 (예: 공개 일정 공유 조회).

## 7. 비동기 작업 패턴

LLM 호출 등 응답이 길어지는 작업(AI 여행 플래너 일정 생성, 여행 후기 자동 작성 등)은 다음 패턴을 따른다.

- **제출 endpoint** — 가능한 동사 없는 RESTful 경로 사용, `POST {resource}`
  - 예: `POST /api/v1/ai-plans` (AI 일정 생성 제출)
  - 캐시/즉시 응답 가능 → `200 OK` + 결과
  - 작업 큐잉 필요 → `202 Accepted` + jobId
  - 동일 사용자/요청 in-flight 일 때는 기존 jobId 재사용 (멱등)
- **상태 조회 endpoint** — `GET /jobs/{jobId}`
  - 본인 작업만 조회 가능 (다른 사용자 jobId 는 `404` 로 응답해 존재 자체 노출 차단)
- **상태 스트림 endpoint** — `GET /jobs/{jobId}/stream` (`text/event-stream`, SSE)
  - 폴링 외에 우선 제공할 수 있다. 하트비트로 연결을 유지하고, 상태 조회와 동일하게 본인 작업만 구독 가능
- **응답 DTO** — `submissionStatus` 또는 `status` 필드로 분기 표현. 결과 페이로드는 status 별 nullable
  - 상태/타입 필드는 raw enum 문자열 대신 `{code, name, description}` metadata 객체로
    내려 프론트가 그대로 표시할 수 있게 한다 (`coding-conventions.md` §11)
- **워커** — 서비스별 전용 `ThreadPoolTaskExecutor` 빈 + `@Async("<빈이름>")` 사용. 글로벌 default(`applicationTaskExecutor`) 공유 금지
  - **빈 이름 규칙**: `{도메인}{용도}TaskExecutor` camelCase (예: `aiPlanTaskExecutor`). 빈 이름이 Micrometer `executor_*` 메트릭의 `name` 태그로 노출되므로, 이름만으로 서비스·용도가 드러나게 짓는다.
  - **thread name prefix 규칙**: 빈 이름과 대응되는 읽기 쉬운 kebab (예: 빈 `aiPlanTaskExecutor` → prefix `ai-plan-worker-`).
  - **풀 사이징 / 종료**: `corePoolSize` / `maxPoolSize` / `queueCapacity` 를 명시하고, graceful shutdown(`setWaitForTasksToCompleteOnShutdown(true)` + `setAwaitTerminationSeconds(...)`)을 설정한다.
  - **풀 크기는 뒤에 있는 자원의 상한을 넘지 않는다** (이슈 [#508](https://github.com/8llow8llowMe/hondigagae/issues/508)).
    워커가 GPU·외부 API 처럼 **동시성이 고정된 자원**을 부르면, 풀을 키워도 처리량은 그 자원의 상한에 묶인다.
    넘겨 잡으면 초과분이 **자원 안에서 이미 전송된 채로** 기다리게 되고, 그동안 각자의 read timeout 시계가 돌아
    **남을 기다린 시간이 자기 예산을 깎는다** — 동시 2건이면 뒤에 온 요청만이 아니라 **먼저 온 요청까지** 함께 죽는다.
    기다림은 반드시 **호출 밖**(대기열 또는 세마포어)에 두고, 타임아웃은 **차례를 받은 뒤부터** 재게 한다.
  - **대기열 길이 × 1건 최악 소요 ≤ PENDING 타임아웃**이어야 한다. 셋은 한 세트라 하나만 바꾸면
    대기열 끝의 잡이 정상 대기 중에 타임아웃 FAILED 로 판정된다. 근거 산술을 빈 javadoc 에 적는다.
  - **혼잡 실패와 요청 자체의 실패는 다른 에러 코드로 가른다.** 사용자가 할 일이 "잠시 후 다시" 와
    "요청을 줄여라" 로 갈리는데, 한 코드로 묶으면 남이 눌러서 실패한 사용자에게 자기 조건을 탓하게 만든다.
- **상태 저장** — Redis Hash / String + TTL 24h. JPA 가 없는 서비스는 Redis 로 충분, 장기 audit 필요 시 DB 추가
- **idempotency 키** — `{prefix}:{domain}:job:idempotency:{memberId}:{requestHash}` 패턴. requestHash 는 `SHA256(jobType | param1=v1 | ...)` 앞 32자
- **에러** — Exception → ErrorCode 매핑은 동기 endpoint 와 동일 패턴 사용, 단 작업 실패는 200 OK + `status=FAILED` + `errorCode/errorMessage` 로 응답 (HTTP 5xx 가 아님)
- **잡 결과를 다른 서비스에 저장하는 "담기"** — 저장하는 서비스가 jobId 를 멱등 키로 받고(`(member_id, job_id)` 유니크 + 이미 있으면 200 으로 기존 자원),
  잡 조회는 그 서비스에 물어 결과 식별자를 싣는다 (이슈 [#970](https://github.com/8llow8llowMe/hondigagae/issues/970), AI 초안 → `POST /api/v1/plans` `sourceAiJobId`).
  잡(Redis)에 "담았다" 를 적지 않는다 — TTL 에 사라지고, 종결 잡은 덮어쓰지 않으며, 두 저장소의 커밋이 갈라져 고아 자원이 생긴다.
  저장한 자원을 지우면 키도 비워 다시 담을 수 있게 한다 (`services/plan-service.md` "AI 초안 담기 멱등").

## 8. AI 대화형 API 설계

AI 여행 상담사 / AI 여행 비서처럼 대화형 상호작용이 필요한 API는 다음 기준을 따른다.

- 대화 세션은 리소스로 관리한다: `POST /api/v1/assistant/conversations` (세션 생성), `POST /api/v1/assistant/conversations/{conversationId}/messages` (메시지 전송)
- 응답 스트리밍이 필요하면 SSE(`text/event-stream`)를 우선한다.
- 일정 변경 같은 부수효과가 있는 대화는 AI가 변경안을 제안하고, 확정은 별도 endpoint(`PUT /api/v1/plans/{planId}/...`)로 분리해 명시적으로 수행한다.

## 9. XAI (추천 이유) 응답 규약

- 추천/분석 응답에는 가능하면 `reasons` 목록을 함께 내린다.
- 각 reason은 `{code, name, description}` metadata 형식을 따르고, 데이터 근거(기온, 혼잡도, 이동거리 등)를 `description`에 사람이 읽을 수 있는 문장으로 담는다.
- 점수형 분석(여행 적합도 등)은 `score` + `reasons` 조합을 기본 형태로 한다.

```json
{
  "score": 82,
  "reasons": [
    { "code": "WEATHER_OK", "name": "기온 적정", "description": "현재 기온 24℃로 반려견 활동에 적합합니다." },
    { "code": "LOW_CONGESTION", "name": "혼잡도 낮음", "description": "관광객 집중도가 낮은 시간대입니다." },
    { "code": "PET_ALLOWED", "name": "반려견 동반 가능", "description": "실내외 모두 반려견 출입이 가능한 시설입니다." }
  ]
}
```

## 10. 사유 코드 enum 을 내릴 때는 `allowableValues` 로 밝히고, 테스트가 enum 과 대조한다 (이슈 [#756](https://github.com/8llow8llowMe/hondigagae/issues/756))

"왜 판정을 못 냈는가" 같은 **사유 코드를 `String` 으로 내리는 응답 필드**는 `@Schema(allowableValues = {...})` 로 허용값을 밝힌다. 설명 문장에 사유를 나열하는 것만으로는 부족하다 — 문장은 기계가 읽을 수 없고, Swagger UI 도 그것으로 허용값 목록을 만들지 못한다.

```java
@Schema(
    description = "판정을 못 낸 사유 코드. 정상이면 null. PAST_DATE 지난 날짜 · ... · LOOKUP_FAILED 조회 실패",
    example = "PAST_DATE",
    allowableValues = {"PAST_DATE", "NO_PLACE_ITEM", "BEYOND_FORECAST_RANGE", "LOOKUP_FAILED"},
    nullable = true)
String unavailableReasonCode,
```

**`allowableValues` 는 enum 을 손으로 복사한 사본이다.** enum 에 사유를 하나 더해도 사본은 그대로 남고 컴파일도 테스트도 전부 통과한다. 그 다음은 정해져 있다 — 프론트가 Swagger 의 허용값만 보고 `switch` 를 짜면 나중에 추가된 사유가 `default` 로 떨어져 화면에 **사유 없는 빈 칸**이 뜬다.

그래서 사본이 갈라지지 않게 **대조를 테스트로 세운다.** plan-service 의 `SchemaAllowableValuesContractTest` 가 본보기다.

- DTO 패키지를 훑어 `allowableValues` 가 비어 있지 않은 필드를 모으고, 테스트 안의 `REGISTRY`(`"SimpleClassName#componentName"` → enum 클래스)와 대조한다.
- 실패는 넷으로 갈라 둔다 — **미등록**(`allowableValues` 가 있는데 레지스트리에 없다) · **불일치**(값 집합이 enum 과 다르다) · **유령 등록**(레지스트리에 있는데 실제 필드가 없다) · **고아 enum**(`*UnavailableReason` enum 인데 어느 응답에도 `allowableValues` 로 내려가지 않는다).
- **새 사유 코드 필드를 만들면 `REGISTRY` 에 등록한다.** `allowableValues` 를 붙였는데 등록을 잊으면 미등록이, **`allowableValues` 를 아예 안 붙였으면 고아 enum 이** 실패해 알려 준다. 앞의 셋은 "사본이 갈라지는 것" 을 막고 넷째는 **"사본을 아예 안 만드는 것"** 을 막는다 — `PlanItemWalkSafetyItem` 이 #756 직전까지 그 상태였다.
- **사유 코드는 record component 에 `@Schema` 를 직접 붙인다.** `@ArraySchema(schema = @Schema(...))` 로 감싸면 대조되지 않는다.
- **순서는 비교하지 않고 집합으로만 본다.** 나열 순서는 DTO 마다 뜻이 다르다(선언 순서 / 판정 순서). 계약이 말해야 하는 것은 무엇이 허용값인가뿐이다.
- `@Schema` 는 record component 가 아니라 **accessor 에서 읽는다** — swagger 의 `@Target` 에 `RECORD_COMPONENT` 가 없어 `RecordComponent#getAnnotation` 은 null 을 준다.
