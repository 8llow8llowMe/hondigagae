# AI Service

## 책임

LLM 기반 AI 기능 전담. 선정된 AI 기능의 LLM 호출·프롬프트·결과 조립을 소유한다.

> **기능 선정 전 단계.** 아래 표는 AI 기능 후보 10종 전체의 배치안이다.
> 실제 구현 대상은 루트 `README.md`의 후보 풀에서 의사결정으로 선정된 기능만이며,
> 선정이 확정되면 이 문서를 선정 기능 중심으로 갱신한다.

| 후보 기능 | 컨텍스트 | 방식 |
|------|----------|------|
| AI 여행 플래너 (일정 생성) | `planner` | 비동기 job |
| 일정 수정 AI (자연어 수정) | `planner` | 비동기 job 또는 동기 |
| AI 여행 상담사 / 여행 비서 | `assistant` | 대화 세션 + SSE |
| 여행 적합도 해설 | `analysis` | 동기 (tour-service 점수 기반 해설) |
| 반려견 성향 분석 | `analysis` | 배치성 분석 + 조회 |
| 여행 스타일 학습 (사용자) | `analysis` | 배치성 분석 + 조회 |
| 여행 후기 자동 작성 | `analysis` | 비동기 job |
| XAI 추천 이유 | 공통 | 모든 추천 응답에 `reasons` 포함 |

## 주요 API (후보 기능 전체 기준 초안)

> 선정에서 제외된 기능의 API는 구현하지 않는다.

- `POST /api/v1/ai-plans` — 일정 생성 제출 (`202` + jobId, 멱등)
  - `petIds`(최대 5) / `petId` 선택 — 둘 다 없으면 **대표 반려견**이 기본값
  - `pinnedPlaceIds`(최대 10) — 필수 포함 장소. 검색 후보에 강제 합류, 없으면 AIPLAN_013 실패
  - `planId` + `regenerateDay` — 하루 재생성. 기존 일정을 plan-service 내부 API 로 받아
    지정한 날만 새로 짠다. 일차 범위는 제출 시점에 검증(AIPLAN_014/015)
  - 검증: 시작일은 오늘 이후(AIPLAN_017), 기간은 최대 10일(AIPLAN_018) — 예보 커버리지(약 11일)와 프롬프트 규모에 맞춘 상한
  - `preferFavorites` — 즐겨찾기 우선 반영. 찜한 장소를 후보에 합치고 [선호] 표시로
    우선 배치를 지시한다. 필수가 아니라 조회 실패는 관용 처리(선호 표시만 빠짐)
  - **여행 기간의 기상청 예보**(tour 내부 API, 약 11일)를 프롬프트 "날씨 전망" 절로 싣는다 —
    강수확률 60%↑ 실내 위주, 최고기온 31℃↑ 야외는 아침·저녁 배치 지시. 커버리지 밖/조회 실패는 절 생략
- `POST /api/v1/ai-plans/packing-list/{planId}` — 반려견 여행 준비물 목록 생성 (동기, 수십 초 가능).
  일정 개요(필수)·반려견 특성·날씨 전망(관용)을 근거로 항목마다 이 여행 데이터 기반의 이유를 붙인다. 저장하지 않는 제안이다
- `GET /api/v1/ai-plans/jobs/{jobId}` — 폴링
- `GET /api/v1/ai-plans/jobs/{jobId}/stream` — SSE
- `POST /api/v1/ai-plans/{planId}/revisions` — 자연어 일정 수정 ("카페 말고 다른 곳")
- `POST /api/v1/assistant/conversations` / `POST .../conversations/{id}/messages` — 상담사·비서 채팅
- `POST /api/v1/reviews/drafts` — 후기 자동 작성
- `GET /api/v1/members/me/pets/{petId}/preferences` — 반려견 성향 분석 결과
- `GET /api/v1/members/me/travel-styles` — 여행 스타일 학습 결과

## 처리 흐름

```text
Controller → Facade → *JobProcessor → *Worker(@Async("aiPlanTaskExecutor")) → Redis 상태 저장/이벤트
```

- 비동기 패턴 세부는 `api-design-guide.md` §7, 대화형 API는 §8을 따른다.
- 일정 생성 파이프라인: 반려견 프로필(auth) + 장소·적합도 데이터(tour) Feign 조회 → 프롬프트 조립 → LLM 호출 → 일정안 검증 → 결과 반환. 사용자가 확정하면 plan-service에 저장된다.

## 구현 주의점

- LLM 호출은 `AiLlmPort` 뒤에 캡슐화한다. 구현은 `OllamaLlmAdapter`(**Spring AI**,
  공유 인프라의 로컬 LLM) 하나다. on/off 스위치나 스텁 어댑터는 두지 않는다 — BossPickSeoul 과
  같은 구조이고, 프론트 개발자가 백엔드를 로컬에 띄우지 않고 dev 서버에 붙기로 해서 LLM 없는
  환경을 위한 분기가 필요 없다. Spring AI 는 첫 호출 때 연결하므로 Ollama 가 없어도 기동은 된다.
- **모델 교체는 `AI_LLM_MODEL` 값 하나로 끝난다** (gpt-oss:20b / qwen2.5:7b-instruct / llama3.1:8b 등,
  Infra/ollama 참고). provider 교체(예: ANTHROPIC)는 spring-ai-{provider} 의존 + 모델 빈 +
  어댑터를 더하는 것으로 끝난다 — application 계층은 손대지 않는다 (BossPickSeoul 동일 구조).
- 구조화 출력은 `BeanOutputConverter` 가 응답 DTO 에서 JSON 스키마를 유도해 프롬프트에 싣고
  파싱까지 맡는다. Ollama `format=json` 이 "JSON 만"을, 스키마 지시가 "어떤 JSON 인지"를 강제한다.
  마크다운 코드 펜스로 감싼 응답도 관용 처리된다(로컬 모델이 자주 내는 형태).
- gpt-oss 계열 추론 강도는 `AI_LLM_REASONING_EFFORT`(기본 low) — medium 은 추론에 생성 토큰
  대부분을 소모한다. 미지원 모델은 이 값을 무시한다.
- Spring AI 내장 재시도(기본 10회)는 끈다. 타임아웃된 생성은 다시 보내도 똑같이 느려서
  GPU 와 워커 스레드만 점유한다 — 실패 처리는 서킷 + 잡 상태로 일원화한다.
- 서킷 인스턴스 `llm` 단일 인스턴스, `slow-call-duration-threshold` 완화 (`coding-conventions.md` §10).
- **일정을 소유하지 않는다** — 생성 결과는 제안(draft)이며, 저장·확정의 원천은 plan-service다.
- **환각은 사후 검증보다 후보를 먼저 주는 방식으로 막는다.** tour-service 에서 동반 가능으로
  확인된 장소 목록을 받아 프롬프트에 싫고 "이 안에서만 고르라"고 한다. 검증은 틀린 답을
  걸러낼 뿐이지만 후보를 주는 방식은 애초에 틀릴 자리를 없앨다.
- **`itemType` 과 `placeId` 는 따로 볼 수 없다 (필수).** `placeId` 는 plan-service 에서
  `targetId` 가 되는데, 그 값이 `place.id` 인지 `walk_course.id` 인지를 `itemType` 이 정한다
  (`shared-travel` 의 `PlanItemType`). 어긋나면 400 도 나지 않고 **틀린 아이디가 조용히 저장된다**
  — `WALK` 는 장소 존재 검증에서 빠지는 유형이기 때문이다 (#89).
  - **ai-service 는 산책 코스를 본 적이 없다.** 후보 목록은 tour-service 의 장소뿐이라
    `walk_course.id` 를 알 방법이 없다. 그래서 초안에는 `WALK` 가 나오지 않는다 —
    산책 일정은 장소 항목으로 내려가고 그 성격은 `title` · `note` 에 담긴다.
  - 그럼에도 모델이 `WALK` 에 장소를 실어 오면 **종류를 `PLACE` 로 바로잡는다.** 아이디는
    후보 집합과 대조해 확인한 값이고 종류는 모델이 자유롭게 적은 값이라, 확인된 쪽을 남긴다.
    반대로 아이디를 끊으면 지도 표시와 장소 요약이 함께 사라진다.
  - 모르는 코드도 같은 자리에서 `PLACE` 로 접는다. plan-service 의 `itemType` 은 enum 이라
    `"CAFE"` 같은 값을 그대로 내려 주면 **사용자가 담는 순간 400** 이 난다.
- 그럼에도 돌아온 `placeId` 를 후보 집합과 다시 대조한다 — 프롬프트 규칙을 어기는 일이
  드물게 있고, 그때 생기는 결과가 나쁘다. 후보 밖 항목은 버리지 않고 **장소 연결만 끊는다** —
  "카페에서 휴식" 같은 항목 자체는 일정의 흐름으로 쓸모가 있다.
- 프롬프트에 개인정보(회원 식별 정보)는 최소화하고, 반려견 특성·여행 조건 등 필요한 정보만 전달한다.
- XAI reasons는 LLM 자유 생성이 아니라, 실제 데이터 근거(기온·혼잡도·이동거리·동반 조건)를 코드에서 조립하고 문장화만 LLM에 맡기는 방향을 우선한다.
- 토큰 사용량 카운터를 두어 운영 비용을 추적한다 (어댑터가 호출당·누적 사용량을 로그로 남긴다).
- 거절(`stop_reason=refusal`)은 HTTP 200 으로 온다. content 를 그냥 읽으면 빈 응답을 파싱 실패로
  오해하게 되므로 `stopReason` 을 먼저 본다 — 원인과 사용자에게 할 말이 전혀 다르다.

## 작업 상태 전달 — SSE + 폴링 폴백

- `GET /jobs/{jobId}/stream` (text/event-stream) — 구독 즉시 현재 상태 스냅샷, 이후 **상태가
  바뀔 때만** 이벤트(PENDING→RUNNING→COMPLETED/FAILED), 종결 시 서버가 연결을 닫는다.
  이벤트 data 는 폴링 응답의 dataBody 와 동일한 JSON 이라 FE 는 처리 코드를 공유한다.
- 전파는 Redis pub/sub(`AiPlanJobEventPort`) — SSE 연결을 잡은 인스턴스와 워커 인스턴스가
  다를 수 있어 저장소 밖 브로드캐스트가 필요하다. 메시지에 상태를 싣지 않고 수신 시 저장소를
  다시 읽는다(발행-저장 순서 역전, 스키마 드리프트 방지).
- 이벤트는 best-effort 다. 유실돼도 25초 하트비트(3회에 1번 상태 재확인)와 폴링 폴백이
  종결을 보장한다. 하트비트의 재확인은 멈춘 잡의 타임아웃 처리(expireIfStuck)도 겸한다.
- 브라우저 기본 EventSource 는 Authorization 헤더를 못 실으므로 fetch 기반 SSE 클라이언트를
  쓴다. 연결이 끊기면 `GET /jobs/{jobId}` 폴링으로 폴백한다. (BossPickSeoul 동일 구조)

## 반려견 특성 주입

- 워커가 잡의 memberId + petIds 로 auth-service 내부 API 를 불러 특성(크기·체중·활동량·
  더위/추위/소음 민감·산책 선호)을 프롬프트의 "함께 여행하는 반려견" 절로 싣는다. 이 절이
  없으면 시스템 프롬프트의 "반려견 기준" 규칙이 빈 구호가 된다.
- 여러 마리면 마리별 절(`[반려견 1]`, `[반려견 2]`…)을 싣는다. 반려견 지정이 없으면
  대표 반려견 특성(`/internal/v1/pets/representative/condition`)을 쓴다.

### 다견 규칙은 쓰임마다 반대다 (필수)

같은 반려견 절을 일정 생성과 준비물이 함께 쓰지만, **여러 마리일 때 덧붙이는 규칙이 정반대**다.
그래서 규칙 문장을 절 안에 박지 않고 호출부가 넘긴다(`PLAN_MULTI_PET_RULE` /
`PACKING_MULTI_PET_RULE`).

| | 규칙 | 왜 |
|---|---|---|
| 일정 생성 | **가장 제약이 큰 아이**가 기준 (가장 큰 크기·가장 무거운 체중) | 한 마리라도 못 들어가면 그 장소는 갈 수 없다 |
| 준비물 | **합집합** — 한 아이에게만 필요한 물건도 넣는다 | 점수를 매기는 일이 아니라 목록을 만드는 일이다. 접으면 다른 아이 물건이 빠진다 |

준비물이 합집합인 대신 **어느 아이 때문인지 이유에 밝히게** 한다 — 항목마다 근거를 붙이는 것이
이 기능의 핵심이라, 합집합으로 만들면서 근거까지 흐려지면 목록 자체가 신뢰를 잃는다.
일자 날씨 판정이 `basisPetId` 로 같은 문제를 푼 것과 같은 방향이다.

준비물의 특성 조회 대상은 `PlanOutline.conditionPetIds()` 가 정한다 — `petIds` 가 있으면 전부,
없으면 대표 한 마리로 접는다(plan-service 가 `petIds` 를 내리기 전에 만들어진 **옛 일정 호환**).
조회는 벌크 한 번이다 (`coding-conventions.md` §9-7).
- 후보 장소 줄에는 입장 크기·체중 제한(allowedPetSize·maxPetWeightKg)을 함께 싣는다 —
  "입장 조건이 맞는 후보만 고를 것" 지시의 판정 근거다.
- 조회 실패·프로필 부재는 특성 없이 진행하되 경고를 남긴다 — auth 장애가 일정 생성 불가로
  번지면 안 된다. 그 경우 반려견 절 자체를 생략한다(없는 값을 지어 적지 않는다).
