# Backend Architecture Guide

## 1. 목표 구조

- 백엔드는 기본적으로 MSA + Hexagonal Architecture를 기준으로 설계한다.
- 서비스는 `auth-service`, `tour-service`, `plan-service`, `ai-service`, `batch-service`를 기준으로 유지한다.
- 공통 모듈은 `common-core`, `persistence-core`, `redis-core`, `security-core`를 사용한다. 복수 서비스가 공유하는 여행 도메인 개념이 생기면 `shared-travel`을 추가한다.
- 모듈별 사용처: `redis-core`는 ai/auth/api-gateway, `security-core`는 ai/auth/plan/tour가 사용한다.

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
  |  \- out
  |     |- persistence
  |     |  |- entity
  |     |  |- repository
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
- `application` 계층이 `adapter` 구현 타입에 의존하면 안 된다.

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
