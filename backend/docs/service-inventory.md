# Backend Service Inventory

> 상태: 전 서비스 **스캐폴딩 완료** (Gradle 멀티모듈 + Hexagonal 패키지 + 1차 API).
> AI 기능은 후보 10종 중 선정 전이므로 ai-service 는 여행 플래너 골격만 구현되어 있다.
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

- 책임: 장소(관광지/음식점/숙박/카페) 검색·상세, 반려견 동반 조건 제공
- 컨텍스트: `place`
- 특징: 조회 중심 서비스, `QueryResult`/`Info`/Presenter 구조 사용. security 의존이 없는 공개 조회 서비스다. batch-service 가 적재한 데이터를 조회한다.
- 구현 API
  - `GET /api/v1/places` (지역·타입·반려견 동반 조건 필터, 커서 기반 `SliceResponse`)
  - `GET /api/v1/places/{placeId}` (intro/petInfo/images 결합 상세)
- 예정: 문화정보원 데이터 적재로 장소 190곳 확보, `nearby-dining`(카카오 로컬 실시간 조회) 추가 — `place-data-integration.md`
- 상태: 구현 (place 컨텍스트). **미착수**: `walkcourse`(두루누비), `insight`(적합도·날씨·혼잡도), `emergency`(동물병원)

## Plan Service

- 책임: 여행 일정 CRUD, 일자별 항목 편집
- 컨텍스트: `plan`
- 특징: write 중심 서비스, 도메인 중심 write 흐름. **일정의 소유권은 이 서비스에 있다** — ai-service 는 제안만 하고 저장·확정은 여기서만 일어난다. 장소 항목은 tour-service Feign 조회로 존재를 검증한다(서킷브레이커 `tour-service`).
- 구현 API
  - `POST /api/v1/plans`, `GET /api/v1/plans` (커서 기반)
  - `GET|PUT|DELETE /api/v1/plans/{planId}`
  - `PUT /api/v1/plans/{planId}/days/{day}/items` (일자 항목 일괄 교체)
- 상태: 구현 (plan 컨텍스트). **미착수**: `review`(여행 후기), 일정 공유

## AI Service

- 책임: 선정된 AI 기능의 LLM 기반 구현. 현재는 AI 여행 플래너(일정 생성) 골격만 있다.
- 컨텍스트: `planner`
- 특징: JPA 없이 Redis 만 사용. 비동기 제출 + 폴링 패턴(`api-design-guide.md` §7), 멱등 키로 in-flight 작업 재사용, 전용 `aiPlanTaskExecutor` 워커. LLM 은 `AiLlmPort` 뒤에 숨겼고 현재 구현은 `StubLlmAdapter`(고정 샘플 + XAI reasons)다.
- 구현 API
  - `POST /api/v1/ai-plans` (202 + jobId)
  - `GET /api/v1/ai-plans/jobs/{jobId}` (폴링)
- 상태: 구현(골격). **미착수**: 실제 LLM 어댑터, SSE 스트림, `assistant`(상담사·비서), `analysis`(성향 분석·후기 작성)

## Batch Service

- 책임: 공공 데이터 수집·대량 적재
- 컨텍스트: `placeimport`
- 특징: Spring Batch + JDBC 배치 upsert(`ON DUPLICATE KEY UPDATE`), 재실행 가능. 실측 API 함정(파라미터 오류 시 flat JSON, 0건일 때 `items=""`)을 어댑터에서 방어한다. 세부 기준은 `external-api-guide.md` §5, `entity-design.md` §11.
- 구현 잡
  - `placeImportJob` — TourAPI 제주 장소 적재 (`areaCode` 파라미터, 기본 39)
- 상태: 구현(장소 적재). **미착수**: 반려동물 동반 정보 결합, 연관 관광지, 두루누비, 혼잡도, 방문자수 잡

## Cloud

- `service-discovery` — Eureka 서버
- `api-gateway` — Spring Cloud Gateway. `/api/v1/{auth,members,places,walk-courses,emergencies,plans,ai-plans,assistant}/**` 라우팅 + JWT 1차 검증 + Swagger 집계
