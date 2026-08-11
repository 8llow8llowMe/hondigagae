# Backend 모듈 구조 & 역할

## 전체 구조 (목표)

```text
backend/
├── core/           (라이브러리 — jar, bootJar off)
│   ├── common-core          범용 공통 인프라 (Response 래퍼, 검증 유틸, Swagger 공통)
│   ├── persistence-core     JPA / QueryDSL / Snowflake ID
│   ├── redis-core           Redis 설정
│   ├── security-core        JWT 인증/인가 공통
│   └── (storage-core)       오브젝트 스토리지 — 후기 사진/프로필 이미지 업로드 필요 시 추가
├── cloud/          (실행 모듈 — bootJar on)
│   ├── api-gateway          Spring Cloud Gateway
│   └── service-discovery    Eureka 서버
└── service/        (도메인 서비스 — bootJar on)
    ├── auth-service         인증·회원·반려견 프로필
    ├── tour-service         관광 데이터·산책 코스·여행 적합도
    ├── plan-service         여행 일정·후기
    ├── ai-service           AI 플래너·비서·분석 (LLM)
    └── batch-service        관광 데이터 수집·대량 적재
```

---

## core/common-core

**역할**: 모든 서비스가 공통으로 쓰는 **인프라 레벨 유틸**

**포함:**
- `dto.Response<T>` — 공통 응답 래퍼
- `dto.DataHeader` — 응답 헤더
- `dto.ValidationErrorBody` / `dto.ValidationErrorItem` — 검증 오류 응답 본문
- `dto.metadata.*` — `CodeNameDescribable`, `CodeNameDescriptionMetadata`, 점수형 metadata
- `enums.OrderType` — 정렬 방향 (ASC/DESC)
- `exception.ValidationErrorSupport` — 공통 검증 예외 → 응답 변환 유틸
- `config.*` — Jasypt, Swagger 공통 설정
- `properties.*` — 공통 properties 바인딩

**포함 기준**: 도메인에 비의존적인 **범용 인프라**. 특정 서비스만 쓰는 도메인 개념은 금지.

---

## core/persistence-core

**역할**: JPA/QueryDSL/ID 생성 공통

**포함:**
- `entity.BaseEntity` — createdAt/updatedAt 감사(auditing)
- `config.JpaAuditConfig` — JPA Auditing 활성화
- `config.QuerydslConfigurer` — QueryDSL `JPAQueryFactory` 빈
- `config.SnowflakeConfigurer` / `util.SnowflakeIdGenerator` — 분산 환경 UUID 대안
- `dto.SliceResponse` — 무한 스크롤 응답
- `properties.SnowflakeProperties` — worker/datacenter 설정

**포함 기준**: DB 접근과 관련된 공통 설정·유틸.

---

## core/redis-core

**역할**: Redis 연결 공통 설정

**포함:**
- `config.RedisConfigurer` — `RedisConnectionFactory`, `RedisTemplate`, `StringRedisTemplate` 빈
  - 객체 저장 시에는 `StringRedisTemplate` + 서비스 `ObjectMapper` 로 JSON 문자열을 직접 읽고 쓰는 방식을 권장한다. (타입 힌트 없는 순수 JSON, 직렬화 실패를 어댑터에서 명시적으로 처리)
- `properties.RedisProperties` — host/port/mode

**포함 기준**: Redis 연동 서비스가 import 해서 쓰는 공통 설정만.

**사용처**: auth-service(토큰/OAuth state), ai-service(작업 상태·결과 캐시), tour-service(날씨·혼잡도 캐시), api-gateway

---

## core/security-core

**역할**: JWT 기반 인증/인가 공통 인프라

**포함:**
- `auth/*` — `auth-service` 전용 (로그인, 토큰 발급)
- `resourceserver/*` — 나머지 서비스용 (토큰 검증만)
  - `ResourceServerSecurityConfigurer`, `JwtToMemberConverter`
- `common/*` — 양쪽 공통
  - `MemberLoginActive` (인증 주체 DTO), `SecurityRole`, `JwtAuthentication`
  - 에러 핸들러, 예외 정의

**포함 기준**: auth-service와 나머지 서비스가 공유하는 보안 구조. 서비스별 인가 정책은 각 서비스에서.

---

## cloud/api-gateway

**역할**: Spring Cloud Gateway — 외부 요청 라우팅 + JWT 검증

**처리:**
- `/api/v1/**` 경로를 각 서비스로 라우팅
- JWT 유효성 1차 검증 (서비스 내부 인가는 각 서비스)
- CORS 공통 처리

---

## cloud/service-discovery

**역할**: Eureka 서버 — 서비스 디스커버리

**처리:**
- 각 서비스가 시작 시 등록
- Feign 클라이언트가 서비스명으로 호출할 수 있게 함

---

## service/auth-service

**역할**: 인증·회원·반려견 프로필

**주요 API (계획):**
- `POST /api/v1/auth/login/kakao` — 카카오 소셜 로그인
- `POST /api/v1/auth/logout`, `POST /api/v1/auth/token/reissue`
- `GET /api/v1/members/me`
- `GET|POST|PUT|DELETE /api/v1/members/me/pets` — 반려견 프로필 (품종, 나이, 더위/추위 민감도, 활동 성향)

**특수 의존**: `core:security-core`의 `auth/` 패키지 (JWT 발급 전용), `core:redis-core` (토큰/OAuth state 저장)

---

## service/tour-service

**역할**: 관광 데이터 조회·검색, 산책 코스, 여행 적합도 분석, 긴급 시설 조회

**주요 API (계획):**
- `GET /api/v1/places` — 반려견 동반 조건 필터 기반 장소 검색 (관광지/음식점/숙박/카페)
- `GET /api/v1/places/{placeId}` — 장소 상세 (반려견 출입 조건 포함)
- `GET /api/v1/places/{placeId}/related` — 연관 관광지
- `GET /api/v1/places/{placeId}/suitability` — 여행 적합도 (날씨+혼잡도+반려견 조건, score+reasons)
- `GET /api/v1/walk-courses` — 두루누비 산책·레저 코스
- `GET /api/v1/emergencies/animal-hospitals` — 위치 기준 24시 동물병원

**컨텍스트**: `place`, `walkcourse`, `insight`(적합도·혼잡도·날씨), `emergency`

**특수 의존**: 외부 공공 API 어댑터 (기상청·혼잡도 실시간), `core:redis-core` (외부 API 응답 캐시)

---

## service/plan-service

**역할**: 여행 일정 CRUD·공유, 여행 기록·후기

**주요 API (계획):**
- `GET|POST /api/v1/plans`, `GET|PUT|DELETE /api/v1/plans/{planId}`
- `PUT /api/v1/plans/{planId}/days/{day}/items` — 일정 항목 편집
- `POST /api/v1/plans/{planId}/reviews` — 여행 후기
- 일정 공유 링크 (향후 카카오 메시지 연계)

**컨텍스트**: `plan`, `review`

**특수 의존**: `core:security-core` (Resource Server), tour-service Feign 호출 (장소 검증/상세)

---

## service/ai-service

**역할**: LLM 기반 AI 기능 전담

**주요 API (계획):**
- `POST /api/v1/ai-plans` — AI 여행 플래너 일정 생성 (비동기 제출)
- `GET /api/v1/ai-plans/jobs/{jobId}` / `GET /api/v1/ai-plans/jobs/{jobId}/stream` — 폴링/SSE
- `POST /api/v1/ai-plans/{planId}/revisions` — 일정 수정 AI (자연어 요청)
- `POST /api/v1/assistant/conversations`, `POST /api/v1/assistant/conversations/{id}/messages` — 여행 상담사/비서 채팅
- `POST /api/v1/reviews/drafts` — 여행 후기 자동 작성
- `GET /api/v1/members/me/pets/{petId}/preferences` — 반려견 성향 분석
- 모든 추천/분석 응답에 XAI `reasons` 포함 (`api-design-guide.md` §9)

**컨텍스트**: `planner`, `assistant`, `analysis`

**처리 흐름**: Controller → Facade → `*JobProcessor` → `*Worker`(`@Async("aiPlanTaskExecutor")`) → Redis 상태 저장/이벤트

**특수 의존**: LLM 어댑터 (`AiLlmPort`), tour-service/plan-service Feign 호출, `core:redis-core`

---

## service/batch-service

**역할**: 관광 데이터 수집·대량 적재용 일회성/주기 배치

**처리 (계획):**
- TourAPI 관광지/음식점/숙박 데이터 적재
- 반려동물 동반여행 API 데이터 결합 (출입 가능 여부·이용 조건)
- 관광지별 연관 관광지 연결성 적재
- 두루누비 산책 코스 적재
- 혼잡도/방문자 추이 예측 데이터 주기 적재

---

## 새 공유 모듈을 만드는 기준

**`core/shared-*` 모듈을 추가할 때:**

1. 복수 서비스가 공유하는 **도메인 개념**이 생겼을 때 (예: `SuitabilityLevel`, `PetAllowanceType`을 tour/ai가 공유)
2. 이걸 `common-core`에 넣으면 "인프라 레이어에 도메인 유출"로 헥사고날 위배일 때
3. 어느 한 서비스에 두면 다른 서비스가 피어 서비스를 import 해야 할 때

→ 이 경우 `core/shared-travel` 같은 도메인 공유 모듈로 분리한다.

**단일 서비스 전용이면:** 해당 서비스의 `application/model/` 또는 `domain/model/`에 둔다.
