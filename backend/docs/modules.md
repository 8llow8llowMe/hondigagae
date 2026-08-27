# Backend 모듈 구조 & 역할

## 전체 구조 (목표)

```text
backend/
├── core/           (라이브러리 — jar, bootJar off)
│   ├── common-core          범용 공통 인프라 (Response 래퍼, 검증 유틸, Swagger 공통)
│   ├── persistence-core     JPA / QueryDSL / Snowflake ID
│   ├── redis-core           Redis 설정
│   ├── security-core        JWT 인증/인가 공통
│   └── storage-core         MinIO 오브젝트 스토리지 (업로드/삭제/키 생성/이미지 검증)
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
- `geo.GeoDistance` — 하버사인 거리와 반경 검색용 사각 범위. 좌표 반경 검색을 쓰는 곳이
  셋(장소·긴급 시설·배치 병합 판정)이라 한곳에 모은다 — 흩어지면 "300m 안"의 뜻이 갈라진다
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
- `properties.RedisProperties` — mode(standalone/sentinel), 접속 정보, 키 prefix

**모드**: 로컬은 `standalone`, dev/prod 는 **Sentinel 3노드**다.

Sentinel 노드 목록은 `infra.redis.sentinel-nodes` 에 `host:port,host:port,host:port` 문자열
하나로 넣는다. 목록형 프로퍼티를 환경변수로 넘기려면 인덱스별 키를 나열해야 하는데
(`..._0_HOST`) Vault·compose 에서 다루기 번거롭고 노드 수가 바뀔 때 빠뜨리기 쉽다.
yml 목록(`infra.redis.sentinels`)도 계속 받지만 로컬용 탈출구다 — 문자열이 있으면 그쪽이 이긴다.

**설정 누락은 기동 시점에 실패시킨다.** `mode=sentinel` 인데 `master-name` 이나 노드 목록이
비면 어떤 값을 설정해야 하는지 적힌 `IllegalStateException` 을 던진다. 형식이 깨진 노드
항목도 조용히 버리지 않고 예외로 올린다 — Sentinel 노드 하나가 조용히 빠지면 평소에는 잘
돌다가 페일오버 때만 못 따라가고, 그때가 되어서야 드러난다.

**포함 기준**: Redis 연동 서비스가 import 해서 쓰는 공통 설정만.

**사용처**: auth-service(토큰/OAuth state), ai-service(작업 상태·결과 캐시), tour-service(날씨·혼잡도 캐시 + 예보 갱신 락), api-gateway

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

## core/storage-core

**역할**: MinIO(S3 호환) 오브젝트 스토리지 접근 공통 모듈

**포함:**
- `config.StorageConfigurer` — `MinioClient`, `ObjectStorageClient`, `StorageBucketInitializer` 빈
- `client.ObjectStorageClient` — 업로드/삭제/공개 URL 조립. 삭제는 `deleteAfterCommit` 으로 커밋 이후 지연 실행
- `model.ImageFileType` — 매직 바이트 기반 이미지 형식 판정 (확장자/Content-Type 불신)
- `util.ObjectKeyFactory` — 서버 생성 키 `{prefix}/{memberId}/{yyyy}/{MM}/{uuid}.{ext}` + 소유권 검증
- `support.MultipartFileSupport` — `MultipartFile` → 도메인 자료형 변환 (어댑터 경계 전용)

**존재 이유**: 업로드 로직을 서비스마다 복사하면 검증 누락과 라이브러리 버전 분기가 생긴다.
검증(크기·형식)을 클라이언트 내부에 두어 호출부가 빠뜨릴 수 없게 했다.

**사용처**: auth-service(프로필 이미지). 여행 후기 사진이 생기면 plan-service 도 사용한다.

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
- `POST /api/v1/auth/login` — 일반 로그인
- `GET /api/v1/auth/{provider}/authorize`, `GET /api/v1/auth/{provider}/login` — 소셜 로그인 (kakao/naver)
- `POST /api/v1/auth/email/send-code|verify-code` — 이메일 인증코드
- `POST /api/v1/auth/logout`, `POST /api/v1/auth/token/reissue`
- `POST /api/v1/members/signup`, `GET|PATCH /api/v1/members/me`
- `POST|DELETE /api/v1/members/me/profile-image`, `POST /api/v1/members/me/password`
- `GET|POST|PUT|DELETE /api/v1/members/me/pets` — 반려견 프로필 (품종, 크기, 민감도, 활동 성향)

**특수 의존**: `core:security-core`의 `auth/` 패키지 (JWT 발급 전용), `core:redis-core` (토큰/OAuth state/이메일 인증/로그인 잠금), `core:storage-core` (프로필 이미지)

---

## service/tour-service

**역할**: 관광 데이터 조회·검색, 산책 코스, 여행 적합도 분석, 긴급 시설 조회

**주요 API (계획):**
- `GET /api/v1/places` — 반려견 동반 조건 필터 기반 장소 검색 (관광지/음식점/숙박/카페)
- `GET /api/v1/places/{placeId}` — 장소 상세 (반려견 출입 조건 포함)
- `GET /api/v1/places/{placeId}/related` — 연관 관광지
- `GET /api/v1/places/{placeId}/suitability` — 여행 적합도 (날씨+혼잡도+반려견 조건, score+reasons)
- `GET /api/v1/places/{placeId}/walk-safety` — 산책 위험도 (추정 노면온도·열지수, 안전 시간대 제안)
- `GET /api/v1/walk-courses` — 두루누비 산책·레저 코스
- `GET /api/v1/places/nearby` — 좌표 반경 장소 검색 (식당·카페 포함)
- `GET /api/v1/emergencies/facilities` — 위치 기준 동물병원·동물약국 반경 검색 (제주 214곳)

**컨텍스트**: `place`, `insight`(적합도·혼잡도·날씨), `emergency`, `walkcourse`(미착수)

**특수 의존**: 외부 공공 API 어댑터 (기상청·혼잡도 실시간), `core:redis-core` (외부 API 응답 캐시)

---

## service/plan-service

**역할**: 여행 일정 CRUD·공유, 여행 기록·후기

**주요 API (계획):**
- `GET|POST /api/v1/plans`, `GET|PUT|DELETE /api/v1/plans/{planId}`
- `PUT /api/v1/plans/{planId}/days/{day}/items` — 일정 항목 편집
- `GET /api/v1/plans/{planId}/weather` — 일자별 날씨 브리핑 + 비 오는 날 실내 대안
- `POST /api/v1/plans/{planId}/reviews` — 여행 후기
- 일정 공유 링크 (향후 카카오 메시지 연계)

**컨텍스트**: `plan`, `review`

**특수 의존**: `core:security-core` (Resource Server), tour-service Feign 호출 (장소 검증/적합도), auth-service Feign 호출 (반려견 특성, 내부 경로)

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
- 혼잡도 예측 주기 적재 + 명칭 매칭 (`congestionImportJob`, 구현)
- 방문자 추이 예측 데이터 주기 적재 (미착수)

---

## 새 공유 모듈을 만드는 기준

**`core/shared-*` 모듈을 추가할 때:**

1. 복수 서비스가 공유하는 **도메인 개념**이 생겼을 때 (예: `SuitabilityLevel`, `PetAllowanceType`을 tour/ai가 공유)
2. 이걸 `common-core`에 넣으면 "인프라 레이어에 도메인 유출"로 헥사고날 위배일 때
3. 어느 한 서비스에 두면 다른 서비스가 피어 서비스를 import 해야 할 때

→ 이 경우 `core/shared-travel` 같은 도메인 공유 모듈로 분리한다.

**단일 서비스 전용이면:** 해당 서비스의 `application/model/` 또는 `domain/model/`에 둔다.

---

## core/shared-travel

**역할**: 서비스를 가로지르는 여행 도메인 enum

**담긴 것:**
- `travel.pet` — `PetSizeType`, `ActivityLevel`, `SocialityLevel` (auth ↔ tour ↔ plan)
- `travel.place` — `PetAllowanceType`, `AllowedPetSize` (tour ↔ ai ↔ batch)
- `travel.insight` — `SuitabilityLevel`, `WalkSafetyLevel` (tour ↔ ai ↔ plan)
- `travel.schedule` — `WeeklySchedule` (batch ↔ tour). 요일별 영업시간과 spec 직렬화.
  배치가 쓰고(문자열 컬럼) 조회가 읽는 계약이라 테이블 스키마와 같은 결로 여기 둔다

**존재 이유**: 위 기준 1번에 해당한다. 적합도를 붙이면서 tour-service 가 반려견 크기를
장소의 입장 조건과 대조해야 했고, 그 둘은 서로 다른 서비스에 있었다. 복사해 두면
"소형견만 가능"을 어느 곳에서는 중형견까지 통과시키는 일이 생긴다.

비교 판정은 enum 안에 둔다 (`AllowedPetSize.allows(PetSizeType)`). 판정이 호출부에 흔어지면
같은 질문에 곳마다 다른 답이 나온다.

**사용처**: auth / tour / plan / ai / batch 전서비스. 이 모듈은 인프라를 알지 않고
`common-core` 의 metadata 인터페이스만 참조한다.
