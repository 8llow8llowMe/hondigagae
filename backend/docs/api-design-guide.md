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
- **상태 저장** — Redis Hash / String + TTL 24h. JPA 가 없는 서비스는 Redis 로 충분, 장기 audit 필요 시 DB 추가
- **idempotency 키** — `{prefix}:{domain}:job:idempotency:{memberId}:{requestHash}` 패턴. requestHash 는 `SHA256(jobType | param1=v1 | ...)` 앞 32자
- **에러** — Exception → ErrorCode 매핑은 동기 endpoint 와 동일 패턴 사용, 단 작업 실패는 200 OK + `status=FAILED` + `errorCode/errorMessage` 로 응답 (HTTP 5xx 가 아님)

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
