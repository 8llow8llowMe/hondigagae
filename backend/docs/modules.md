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
- `dto.ValidationErrorItem` — 필드 단위 검증 오류 항목 (`dataHeader.fieldErrors` 의 원소)
- `dto.metadata.*` — `CodeNameDescribable`, `CodeNameDescriptionMetadata`, 점수형 metadata
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

**명령·연결 타임아웃 (선택, #1253)**: `infra.redis.command-timeout` · `infra.redis.connect-timeout` 에 `1s` 같은
Duration 을 적는다. 지금 적은 곳은 **api-gateway 뿐**이다(`1s` · `2s`). 다른 서비스가 적을지는 서비스별로 판단한다.

- **둘 다 비우면 예전 팩토리 그대로다** — 클라이언트 설정 없이 만들어 Lettuce 기본을 쓴다. 그 기본은 명령이
  **동기 60초**(Spring Data Redis 가 끊는다) · **리액티브·비동기 상한 없음**(Lettuce `TimeoutOptions` 꺼짐), 연결 10초다.
  Redis 가 연결을 거부하면 바로 실패하지만 먹통(패킷 드롭 · 응답 없음)이면 그만큼 기다린다
- **하나라도 적으면** `LettuceClientConfiguration` 으로 넘긴다(standalone · sentinel 같다). 명령 타임아웃 감시
  (`TimeoutOptions.enabled()`)를 **함께 켜서 리액티브 명령도 같은 시간에 끝난다** — 연결 타임아웃을 담으려고
  `ClientOptions` 를 새로 넘기면 빌더 기본에 있던 감시가 사라지므로 명시한다. 0 이하는 기동 시점에 실패한다
- **명령 타임아웃은 `QueryTimeoutException` 으로 나온다** (Lettuce `RedisCommandTimeoutException` 을 Spring Data Redis 가
  번역). 연결 실패 `RedisConnectionFailureException` 과 예외 계층이 달라, Redis 장애를 잡는 코드는 상위 `DataAccessException` 으로 함께 잡는다(게이트웨이 블랙리스트 · auth-service `isRevoked`)
- 끊긴 동안 명령을 쌓아 두는 Lettuce 기본(`DisconnectedBehavior.DEFAULT`)은 바꾸지 않았다. 감시는 명령을 쓰는 시점부터
  재므로 재연결을 기다리며 쌓인 명령도 명령 타임아웃에 끝난다. `REJECT_COMMANDS` 로 바꾸면 즉시 실패하지만 페일오버 같은
  짧은 재연결 순간의 명령까지 곧바로 오류가 된다 — 쌓아 두되 명령 타임아웃(게이트웨이 1초)이 대기 상한이다
- 공유 연결을 **처음** 맺을 때는 호출 스레드가 연결 타임아웃(+ 핸드셰이크, 명령 타임아웃만큼)을 기다린다. 리액티브 연결도 같고,
  동기·리액티브 공유 연결이 `LettuceConnectionFactory` 의 **락 하나**를 쓴다 — 기동 시점부터 먹통이면 첫 연결 시도들이 그 락에서
  줄을 선다. 그래서 리액티브 체인(WebFlux)에서 Redis 를 부르는 곳은 리액티브 템플릿이라도 **이벤트 루프 밖에서 구독한다**(게이트웨이)
- 고정: `RedisConfigurerClientTimeoutTest`(설정 · 바인딩), `RedisCommandTimeoutBehaviorTest`(가짜 Redis 로 실제 예외 타입과 시간)

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

**의존**: `core:common-core` (#502). 기본 오류 writer(`DefaultSecurityErrorResponseWriter`)가
401·403 을 공통 응답 봉투(`Response`/`DataHeader`)로 쓴다. common-core 는 security-core 를
모르므로 순환이 아니고, `shared-travel` 과 같은 이유로 `implementation` 이다.

> **기본값이 곧 계약이다.** 전에는 기본 writer 가 `{code, message}` 자체 포맷이었고 세 서비스가
> `@Primary` 로 같은 설정을 복사해 덮었다. 새 서비스가 그 복사를 잊으면 그 서비스의 401/403 만
> 봉투 밖으로 나가 프론트가 사유를 통째로 버렸다. security-core 를 붙이는 서비스는 이제
> **오버라이드 없이 그대로 쓰면 된다.**

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
- `/api/v1/**` 경로를 각 서비스로 라우팅 — 라우트는 프로파일 yml 3개(local/dev/prod)에 **접두어 단위**로 나열한다.
  컨트롤러가 새 접두어를 열면 셋 다 고쳐야 하며, `GatewayRouteCoverageTest` 가 컨트롤러 `@RequestMapping` 접두어 ⊆ 라우트를 검사한다
- JWT 유효성 1차 검증 (서비스 내부 인가는 각 서비스)
  - 로그아웃 블랙리스트 확인(`AccessTokenBlacklistChecker`)은 블로킹 Redis 호출이라 **이벤트 루프 밖(`boundedElastic`)에서
    돈다** (#1253). 전에는 Netty 이벤트 루프 위에서 불러, Redis 가 먹통인 동안 그 루프의 다른 요청(공개 API 포함)까지 최대
    60초 멈췄다. Redis 를 읽지 못하면 연결 실패든 명령 타임아웃(`infra.redis.command-timeout: 1s`)이든 같은 규칙이다 —
    기본 fail-closed 503 `SECURITY_008`, `jwt.blacklist-fail-open` 이면 통과. 전에는 명령 타임아웃이 500 으로 샜다
  - 인증 스킴은 **대소문자를 가리지 않고** 읽는다 (#1261, RFC 7235). 하류 resource server(`DefaultBearerTokenResolver`)가
    `bearer` · `BEARER` 도 인증하므로 게이트웨이만 가리면 소문자 스킴 토큰을 "토큰 없음" 으로 보고 블랙리스트 확인을
    건너뛰어, 로그아웃한 토큰이 남은 수명 동안 통했다. 두 쪽 해석이 같은지는 `JwtAuthApiGatewayFilterTest` 가 하류
    정규식을 옮겨 잠근다 — 의존성을 올리면 그 정규식과 다시 대조한다
- CORS 공통 처리
- **레이트 리밋** — 공유 링크 공개 라우트(`plan-service-shared-plans`)에만 `SharedPlanRateLimit` 필터를 건다 (#1244).
  공유 토큰 전용이라 다른 라우트에 걸면 판정 없이 통과한다. 키는 공유 토큰의 SHA-256 해시(링크 단위, 발급 형식이
  아닌 토큰은 고정 키 하나), 한도는 링크당 초당 2 · 버스트 20, 거부는 429 + `GATEWAY_001` 봉투, Redis 장애 시 통과(fail-open). 판정은 SCG `RedisRateLimiter` 이고, 그 자동구성이 서도록 게이트웨이가
  `ReactiveStringRedisTemplate` 을 직접 올린다 — redis-core 의 연결 팩토리 선언 반환형이 `RedisConnectionFactory` 라
  리액티브 자동구성이 저절로 켜지지 않는다(`ApiGatewayRateLimitConfig`). 근거·잔여 위험은 `services/plan-service.md`
  "공개 경로 레이트 리밋"
- **이벤트 루프에서 Redis 연결 락을 기다리지 않는다** (#1253) — 블랙리스트 확인도 리밋 판정도 `boundedElastic` 에서
  구독한다. 리미터는 리액티브지만 구독될 때 공유 리액티브 연결을 얻고, 그 연결은 동기 공유 연결과 같은 팩토리 락 아래에서
  처음 맺어진다. 남은 위험: 기동 시점부터 Redis 가 먹통이면 첫 연결 시도(연결 2초 + 핸드셰이크 1초)가 그 락에서 줄을 선다.
  그 대기는 이제 `boundedElastic` 쪽(블랙리스트 · 리밋 판정 · 액추에이터 Redis 헬스)에서만 일어나 둘과 무관한 요청은 멈추지
  않지만, 공유 요청과 토큰을 실은 요청은 그만큼 늦는다 (`services/plan-service.md` 남은 위험)

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

**특수 의존**: `core:security-core`의 `auth/` 패키지 (JWT 발급 전용), `core:redis-core` (토큰/OAuth state/이메일 인증/로그인 잠금), `core:storage-core` (프로필 이미지), plan-service Feign 호출 (반려견 삭제 직후 동행 목록 대사 트리거, 내부 경로, #972 — 이 서비스의 유일한 서비스 간 호출)

---

## service/tour-service

**역할**: 관광 데이터 조회·검색, 산책 코스, 여행 적합도 분석, 긴급 시설 조회

**주요 API (계획):**
- `GET /api/v1/places` — 반려견 동반 조건 필터 기반 장소 검색 (관광지/음식점/숙박/카페)
- `GET /api/v1/places/{placeId}` — 장소 상세 (반려견 출입 조건 포함)
- `GET /api/v1/places/{placeId}/related` — 연관 관광지
- `GET /api/v1/places/{placeId}/suitability` — 여행 적합도 (날씨+혼잡도+반려견 조건, score+reasons)
- `GET /api/v1/places/{placeId}/walk-safety` — 산책 위험도 (추정 노면온도·열지수, 안전 시간대 제안)
- `GET /api/v1/walk-courses` — 제주올레 산책 코스 (두루누비는 제주 코스가 0개라 원천 교체, #382)
- `GET /api/v1/places/nearby` — 좌표 반경 장소 검색 (식당·카페 포함)
- `GET /api/v1/emergencies/facilities` — 위치 기준 동물병원·동물약국 반경 검색 (제주 213곳)

**컨텍스트**: `place`, `insight`(적합도·혼잡도·날씨), `emergency`, `walkcourse`(미착수)

**특수 의존**: 외부 공공 API 어댑터 (기상청·혼잡도 실시간), `core:redis-core` (외부 API 응답 캐시)

---

## service/plan-service

**역할**: 여행 일정 CRUD·공유, 여행 기록·후기

**주요 API (계획):**
- `GET|POST /api/v1/plans`, `GET|PUT|DELETE /api/v1/plans/{planId}`
- `PUT /api/v1/plans/{planId}/days/{day}/items` — 일정 항목 편집
- `GET /api/v1/plans/{planId}/weather` — 일자별 날씨 브리핑 + 비 오는 날 실내 대안
- `GET|POST|PUT /api/v1/plans/{planId}/reviews` — 여행 후기 v1 (사진·공개 없음)
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
- 제주올레 산책 코스 적재 (올레코스현황 CSV + TourAPI 좌표 매칭, #383)
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
- `travel.plan` — `PlanItemType` (plan ↔ ai). **`targetId` 가 어느 아이디 공간을 가리키는지**를
  함께 정한다(`isPlaceTarget()`). AI 초안 항목은 사용자가 그대로 담으므로 ai-service 의
  `itemType` 은 plan-service 의 저장 규칙을 그대로 따라야 한다

**존재 이유**: 위 기준 1번에 해당한다. 적합도를 붙이면서 tour-service 가 반려견 크기를
장소의 입장 조건과 대조해야 했고, 그 둘은 서로 다른 서비스에 있었다. 복사해 두면
"소형견만 가능"을 어느 곳에서는 중형견까지 통과시키는 일이 생긴다.

비교 판정은 enum 안에 둔다 (`AllowedPetSize.allows(PetSizeType)`). 판정이 호출부에 흔어지면
같은 질문에 곳마다 다른 답이 나온다.

**사용처**: auth / tour / plan / ai / batch 전서비스. 이 모듈은 인프라를 알지 않고
`common-core` 의 metadata 인터페이스만 참조한다.
