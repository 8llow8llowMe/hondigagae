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

- LLM 호출은 `AiLlmPort` 뒤에 캡슐화하고 provider(OpenAI 호환 / 기타) 어댑터를 분기 가능하게 둔다.
- 서킷 인스턴스 `llm` 단일 인스턴스, `slow-call-duration-threshold` 완화 (`coding-conventions.md` §10).
- **일정을 소유하지 않는다** — 생성 결과는 제안(draft)이며, 저장·확정의 원천은 plan-service다.
- LLM이 추천한 장소는 반드시 tour-service 데이터로 존재·동반 가능 여부를 검증한다 (환각 방지).
- 프롬프트에 개인정보(회원 식별 정보)는 최소화하고, 반려견 특성·여행 조건 등 필요한 정보만 전달한다.
- XAI reasons는 LLM 자유 생성이 아니라, 실제 데이터 근거(기온·혼잡도·이동거리·동반 조건)를 코드에서 조립하고 문장화만 LLM에 맡기는 방향을 우선한다.
- 토큰 사용량 카운터를 두어 운영 비용을 추적한다.
