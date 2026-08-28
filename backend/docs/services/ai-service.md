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

- LLM 호출은 `AiLlmPort` 뒤에 캡슐화한다. 현재 구현은 `OllamaLlmAdapter`(**Spring AI**,
  공유 인프라의 로컬 LLM)이고, `ai-llm.enabled=false`(기본)이면 `StubLlmAdapter` 가 대신 뜬다.
  스텁을 남겨 둔 이유는 프론트 개발과 CI 가 로컬 LLM 기동 여부에 묶이면 안 되기 때문이다.
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
- 그럼에도 돌아온 `placeId` 를 후보 집합과 다시 대조한다 — 프롬프트 규칙을 어기는 일이
  드물게 있고, 그때 생기는 결과가 나쁘다. 후보 밖 항목은 버리지 않고 **장소 연결만 끊는다** —
  "카페에서 휴식" 같은 항목 자체는 일정의 흐름으로 쓸모가 있다.
- 프롬프트에 개인정보(회원 식별 정보)는 최소화하고, 반려견 특성·여행 조건 등 필요한 정보만 전달한다.
- XAI reasons는 LLM 자유 생성이 아니라, 실제 데이터 근거(기온·혼잡도·이동거리·동반 조건)를 코드에서 조립하고 문장화만 LLM에 맡기는 방향을 우선한다.
- 토큰 사용량 카운터를 두어 운영 비용을 추적한다 (어댑터가 호출당·누적 사용량을 로그로 남긴다).
- 거절(`stop_reason=refusal`)은 HTTP 200 으로 온다. content 를 그냥 읽으면 빈 응답을 파싱 실패로
  오해하게 되므로 `stopReason` 을 먼저 본다 — 원인과 사용자에게 할 말이 전혀 다르다.
