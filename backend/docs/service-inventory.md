# Backend Service Inventory

> 서비스별 책임과 주의점 요약. 무엇이 되고 안 되는지의 단일 기준은 `feature-status.md` 다.
> 로컬 실행 절차는 `local-run-guide.md` 참고.

## Auth Service

- 책임: 일반 로그인(이메일+비밀번호)·소셜 로그인(카카오/네이버), 이메일 인증, 회원 관리, 프로필 이미지, 반려견 프로필
- 컨텍스트: `auth`, `member`, `pet`
- 특징: `auth`/`member` 는 **BossPickSeoul auth-service 와 동일 구조**다. 여러 소셜 제공자를 붙일 예정이라
  원본의 회원 모델(email 식별 + provider 연결, 동일 이메일 자동 연결)을 그대로 쓴다. `pet` 은 혼디가개 고유 컨텍스트다.
- 구현 API
  - `POST /api/v1/auth/login`, `GET /api/v1/auth/{provider}/authorize`, `GET /api/v1/auth/{provider}/login`
  - `POST /api/v1/auth/email/send-code`, `POST /api/v1/auth/email/verify-code`
  - `POST /api/v1/auth/token/reissue`, `POST /api/v1/auth/logout`
  - `POST /api/v1/members/signup`, `GET|PATCH /api/v1/members/me`
  - `POST|DELETE /api/v1/members/me/profile-image`, `POST /api/v1/members/me/password`, `POST /api/v1/members/me/withdraw`
  - `GET|POST /api/v1/members/me/pets`, `GET|PUT|DELETE /api/v1/members/me/pets/{petId}`
- 상태: 구현. 원본의 북마크(관심 상권)는 도메인이 달라 제외했다.

## Tour Service

- 책임: 장소(관광지/음식점/숙박/카페) 검색·상세, 반려견 동반 조건 제공, 여행 적합도·산책 위험도 분석
- 컨텍스트: `place`, `emergency`, `insight`
- 특징: 조회 중심 서비스, `QueryResult`/`Info`/Presenter 구조 사용. security 의존이 없는 공개 조회 서비스다. batch-service 가 적재한 데이터를 조회한다.
- 구현 API
  - `GET /api/v1/places` (지역·타입·반려견 동반 조건 필터, 커서 기반 `SliceResponse`)
  - `GET /api/v1/places/{placeId}` (intro/petInfo/images 결합 상세)
  - `GET /api/v1/places/nearby` (좌표 반경 검색, 식당·카페 포함)
  - `GET /api/v1/emergencies/facilities` (동물병원·동물약국 반경 검색, `openNowOnly` 지금 영업 중 필터)
  - `GET /internal/v1/places/visible-ids` (내부 전용 — plan 의 일정 항목 벌크 검증)
  - `GET /api/v1/places/{placeId}/suitability` (날씨+동반조건+혼잡도, score + XAI reasons)
  - `GET /api/v1/places/{placeId}/walk-safety` (추정 노면온도·열지수 기반 산책 위험도)
- 상태: 구현 (`place`, `emergency`, `insight`). **미착수**: `walkcourse`(두루누비)
- `insight` 는 기상청 단기예보를 격자별 Redis 캐시로 쓰고, 집중률은 배치 적재분을 DB 에서 읽는다.
  반려견 조건은 사본을 두지 않고 요청 파라미터로 받는다 — 이 서비스는 인증이 없는 공개 조회
  서비스고, 프로필의 원천은 auth-service 다. 세부는 `weather-insight-integration.md` 참고.

## Plan Service

- 책임: 여행 일정 CRUD, 일자별 항목 편집
- 컨텍스트: `plan`
- 특징: write 중심 서비스, 도메인 중심 write 흐름. **일정의 소유권은 이 서비스에 있다** — ai-service 는 제안만 하고 저장·확정은 여기서만 일어난다. 장소 항목은 tour-service Feign 조회로 존재를 검증한다(서킷브레이커 `tour-service`).
- 구현 API
  - `POST /api/v1/plans`, `GET /api/v1/plans` (커서 기반)
  - `GET|PUT|DELETE /api/v1/plans/{planId}`
  - `PUT /api/v1/plans/{planId}/days/{day}/items` (일자 항목 일괄 교체)
  - `GET /api/v1/plans/{planId}/weather` (일자별 날씨 브리핑 + 비 오는 날 실내 대안)
- 날씨 브리핑은 적합도를 **다시 계산하지 않고** tour-service 결과를 그대로 옮긴다. 같은 규칙을
  두 곳에서 구현하면 일정 화면과 장소 화면이 같은 날 같은 곳을 다르게 말하게 된다.
  반려견 특성은 auth-service 내부 API(`/internal/v1/pets/{petId}/condition`)에서 받는다.
- 상태: 구현 (plan 컨텍스트). **미착수**: `review`(여행 후기), 일정 공유

## AI Service

- 책임: 선정된 AI 기능의 LLM 기반 구현. 현재는 AI 여행 플래너(일정 생성)가 동작한다.
- 컨텍스트: `planner`
- 특징: JPA 없이 Redis 만 사용. 비동기 제출 + 폴링 패턴(`api-design-guide.md` §7), 멱등 키로 in-flight 작업 재사용, 전용 `aiPlanTaskExecutor` 워커.
- 구현 API
  - `POST /api/v1/ai-plans` (202 + jobId)
  - `GET /api/v1/ai-plans/jobs/{jobId}` (폴링)
- LLM 은 `AiLlmPort` 뒤에 숨어 있고 구현이 둘이다.
  - `AnthropicClaudeLlmAdapter` — Anthropic 공식 Java SDK, 구조화 출력로 응답 형태를 강제한다.
    `ai-llm.enabled=true` 일 때만 뜼다
  - `StubLlmAdapter` — 기본값. 키 없이도 제출→폴링→완료 흐름이 돌아가야 프론트 개발과 CI 가
    토큰 비용에 묶이지 않는다
- **환각 방지는 후보를 먼저 주는 방식이다.** tour-service 에서 동반 가능으로 확인된 장소 목록을
  받아 프롬프트에 싫고, 돌아온 `placeId` 를 다시 후보 집합과 대조한다. 사후 검증보다 나은 이유는
  검증은 틀린 답을 걸러낼 뿐이지만 후보를 주는 방식은 애초에 틀릴 자리를 없애기 때문이다.
- 상태: 구현(`planner`). **미착수**: SSE 스트림, 자연어 일정 수정, `assistant`(상담사·비서), `analysis`(성향 분석·후기 작성)

## Batch Service

- 책임: 공공 데이터 수집·대량 적재
- 컨텍스트: `placeimport`, `congestionimport`
- 특징: Spring Batch + JDBC 배치 upsert(`ON DUPLICATE KEY UPDATE`), 재실행 가능. 실측 API 함정(파라미터 오류 시 flat JSON, 0건일 때 `items=""`)을 어댑터에서 방어한다. 세부 기준은 `external-api-guide.md` §5, `entity-design.md` §11.
- 구현 잡
  - `placeImportJob` — TourAPI 제주 장소 적재 (`areaCode` 파라미터, 기본 39)
  - `cultureFacilityImportJob` — 문화정보원 문화시설 + 긴급 시설
  - `petRestaurantImportJob` — 식약처 음식점 + VWorld 지오코딩
  - `congestionImportJob` — 관광지 집중률 예측 + 명칭 매칭(`place_name_link`)
- `congestionImportJob` 은 **`placeImportJob` 이후에 돌려야 한다.** 장소가 비어 있으면 전부
  UNMATCHED 로 적재되고 적합도 응답에서 혼잡도가 계속 빠진다. 매칭률은 배치 로그로 남긴다 —
  커버리지가 조용히 떨어지는 것이 이 방식의 가장 큰 위험이다.
- 상태: 구현. **미착수**: 연관 관광지, 두루누비, 방문자수 잡

## Cloud

- `service-discovery` — Eureka 서버
- `api-gateway` — Spring Cloud Gateway. `/api/v1/{auth,members,places,walk-courses,emergencies,plans,ai-plans,assistant}/**` 라우팅 + JWT 1차 검증 + Swagger 집계
