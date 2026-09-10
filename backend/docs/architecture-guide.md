# Backend Architecture Guide

## 1. 목표 구조

- 백엔드는 기본적으로 MSA + Hexagonal Architecture를 기준으로 설계한다.
- 서비스는 `auth-service`, `tour-service`, `plan-service`, `ai-service`, `batch-service`를 기준으로 유지한다.
- 공통 모듈은 `common-core`, `persistence-core`, `redis-core`, `security-core`, `storage-core`, `shared-travel` 을 사용한다.
- 모듈별 사용처: `redis-core`는 ai/auth/tour/api-gateway, `security-core`는 ai/auth/plan 이 사용한다.
- `shared-travel` 은 서비스를 가로지르는 여행 도메인 enum 을 담는다 — `PetSizeType`/`ActivityLevel`/
  `SocialityLevel`(auth ↔ tour ↔ plan), `PetAllowanceType`/`AllowedPetSize`(tour ↔ ai),
  `SuitabilityLevel`/`WalkSafetyLevel`(tour ↔ ai ↔ plan). 같은 enum 을 서비스마다 복사하면
  "소형견만 가능"을 어느 곳에서는 중형견까지 통과시키는 일이 생긴다.

## 2. 기본 패키지 구조

```text
domainlayer/<context>
  |- adapter
  |  |- in/web
  |  |  |- controller
  |  |  |- dto/request
  |  |  |- dto/response
  |  |  |- dto/item
  |  |  |- exception          (*ExceptionHandler)
  |  |  \- presenter
  |  |- in/internal           (서비스 간 전용 — 게이트웨이가 라우팅하지 않는 /internal/v1)
  |  |  \- controller
  |  |- in/batch              (배치 잡 진입점 — *JobConfig, tasklet, listener. batch-service)
  |  |- in/scheduler          (시각이 부르는 진입점 — Quartz JobDetail/Trigger, @Scheduled)
  |  \- out
  |     |- persistence
  |     |  |- entity
  |     |  |- repository
  |     |  |  \- custom       (*CustomRepository + Impl — QueryDSL 동적 쿼리·조인)
  |     |  \- *Adapter
  |     \- client
  |- application
  |  |- command
  |  |- exception             (*ErrorCode, *Exception, *ValidationMessage)
  |  |- info
  |  |- mapper
  |  |- model
  |  |- port/in
  |  |- port/out
  |  \- service
  |     |- *WebFacade
  |     \- processor
  \- domain
     \- model
```

- `application/exception`, `adapter/in/web/exception` 구성은 `coding-conventions.md` §8-1의 필수 패턴을 따른다.

## 3. 계층 책임

### Controller

- `*WebUseCase`만 호출한다.
- 요청 바인딩, 인증 주체 해석, 응답 래핑까지만 담당한다.
- 응답은 기본적으로 `ResponseEntity<Response<T>>`를 사용한다.

### WebUseCase

- 웹 진입점에서 필요한 유스케이스 계약을 정의한다.
- Controller와 1:1 또는 매우 가까운 단위로 맞춘다.

### WebFacade

- 유스케이스 진입점의 메인 오케스트레이터다.
- 여러 Processor와 Presenter를 조합한다.
- 읽기는 `@Transactional(readOnly = true)`, 쓰기는 `@Transactional`을 기본으로 검토한다.
- **예외**: 유스케이스에 외부 I/O(OAuth·LLM·공공 API 호출)가 섞이면 트랜잭션을 Facade에 걸지 않는다.
  DB 커넥션을 잡은 채 원격 응답을 기다리게 되기 때문이다. 이때는 외부 호출을 트랜잭션 밖에 두고
  DB 접근 구간만 Processor 단위로 `@Transactional`을 건다 (예: `KakaoLoginProcessor.login`).
  이 경우 왜 좁혔는지 메서드 주석으로 남긴다.

### Processor

- 실제 애플리케이션 로직을 처리한다.
- `Info`, domain model, application model을 반환한다.
- Response DTO를 직접 만들지 않는다.
- Port 호출, 도메인 조합, 검증, ID 생성 책임을 가진다.

### Presenter

- `Info -> Response`, `Info -> Item` 변환만 담당한다.
- API 응답 모양은 Presenter에서 마무리한다.

### Port / Adapter

- `application/port/out`은 외부 시스템에 대한 계약만 노출한다.
- `adapter/out/*`는 JPA, Redis, 외부 API(TourAPI, 기상청, 카카오, LLM 등), 내부 서비스 호출 세부사항을 숨긴다.
- `application` 계층이 `adapter` 구현 타입에 의존하면 안 된다. 단 아래 셋은 **문서화된 예외**다.
  - `port/in`(`*WebUseCase`)의 반환 타입은 `adapter/in/web/dto`의 Response/Item DTO를 쓴다.
  - `*WebFacade`는 Presenter를 주입받아 조합한다 (WebFacade의 책임 자체가 조합이다).
  - `application/mapper`의 MapStruct 매퍼는 Entity ↔ Domain 변환이므로 Entity를 참조한다.
- 예외에 해당하지 않는 방향, 특히 **out-adapter 타입(외부 API 응답 DTO, Feign 래퍼)이 application으로 새는 것**은 금지한다.
  out-port 반환 타입에는 `QueryResult` 또는 domain model을 쓰고, `Info`를 노출하지 않는다.

## 4. Query / Model 경계

- 조회 결과가 복잡하면 `application/port/out/query/*QueryResult`를 사용한다.
- `QueryResult`는 out-port 계약과 adapter 변환 결과를 표현한다.
- `Processor`는 필요 시 `QueryResult -> application/model` 변환을 수행한다.
- prompt, facade, presenter 쪽에는 `QueryResult`가 직접 번지지 않게 유지한다.
- `Info`는 외부 포트나 adapter 경계로 새지 않게 한다.

## 5. Write 경계

- 저장 흐름은 가능하면 `domain -> entity -> repository.save -> entity -> domain`을 유지한다.
- ID 생성은 Processor 또는 상위 오케스트레이션에서 수행한다.
- 단순 조회 모델과 저장 모델을 억지로 하나로 합치지 않는다.

## 6. 보안 기준

- `auth-service`는 인증/인가 전용 Security 구성을 사용한다. 소셜 로그인은 카카오를 기본으로 한다.
- 나머지 서비스는 Resource Server 기준으로 JWT claim을 해석한다.
- 게이트웨이는 JWT 유효성 검증 및 라우팅에 집중하고, 서비스 내부 권한 해석은 각 서비스가 담당한다.

## 7. 내부 서비스 HTTP 호출 기준

- Spring 백엔드 서비스 간 동기 HTTP 호출은 기본적으로 `FeignClient`를 사용한다.
  - 예: ai-service가 일정 생성 시 tour-service의 장소/적합도 데이터를 조회
- 내부 서비스 호출 계약은 `application/port/out` 뒤의 `adapter/out/client`에서만 캡슐화한다.
- `FeignClient -> Adapter -> QueryResult` 흐름을 기본 패턴으로 유지한다.
- `application` 계층은 Feign 세부 설정이나 외부 응답 래퍼 구조를 직접 알지 않는다.
- 내부 호출에는 공통 타임아웃과 Resilience4j CircuitBreaker를 적용해 상대 서비스 장애가
  호출한 서비스 전체로 전파되지 않게 한다. 서킷 오픈·전송 실패는 `adapter/out/client` 안에서
  각 도메인 예외(503)로 변환하고, `FeignException`류를 상위 계층으로 노출하지 않는다.
  세부 규칙은 `coding-conventions.md` §10 참고.
- `WebClient`는 외부 API 연동, 스트리밍, 비동기/반응형 요구가 명확할 때 우선 검토한다.

## 8. 외부 데이터 API 연동 기준

- TourAPI, 반려동물 동반여행, 두루누비, 혼잡도, 기상청, 카카오 등 외부 API는 반드시
  `adapter/out/client` 뒤에 캡슐화하고, out-port는 도메인 책임으로 명명한다 (`external-api-guide.md` 참고).
- 외부 API 원본 응답(XML/JSON 래퍼)은 adapter 밖으로 새지 않는다. adapter에서 `QueryResult` 또는 domain model로 변환한다.
- 호출량 제한(쿼터)이 있는 공공 API는 배치 적재(batch-service) + DB 조회를 우선하고,
  실시간성이 필요한 데이터(날씨, 혼잡도)만 캐시를 앞에 둔 실시간 호출을 검토한다.
