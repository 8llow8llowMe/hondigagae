# Backend Team Playbook

## 목적

- 이 문서는 `hondigagae/backend` 작업을 멀티 에이전트 방식으로 나눠 진행할 때의 기준 문서다.
- 큰 기능 추가, 구조 리팩토링, DB/보안/API가 함께 걸린 작업에서 역할 분담을 명확히 하기 위해 사용한다.
- 목표는 속도보다 품질을 높이는 것이며, 최종 통합 책임은 항상 메인 실행자에게 있다.

## 언제 사용하는가

- 서비스 하나를 새로 추가하거나 기존 서비스를 크게 확장할 때
- DB, Redis, API, Security, 문서가 한 번에 같이 바뀌는 작업일 때
- 헥사고날 계층 경계가 흔들릴 가능성이 큰 리팩토링일 때
- 구현과 검증을 분리해서 더 안정적으로 진행하고 싶을 때

다음과 같은 작은 작업에는 보통 사용하지 않는다.

- 단일 파일 수정
- 명확한 버그 수정 1건
- 단순 문구 / 로그 / Swagger 정리

## 역할 정의

### Backend Leader

- 작업 범위와 산출물을 먼저 고정한다.
- 서비스 경계와 API 방향을 결정한다.
- 여러 검토 결과를 취합하고 최종 통합 기준을 정리한다.

### Backend Executor

- 실제 코드를 수정한다.
- Controller, Facade, Processor, Port, Adapter를 구현한다.
- compile, test, check 기준으로 동작을 맞춘다.

### DB Reviewer

- entity, query result, repository, index, soft delete, Redis key 구조를 검토한다.
- 단일 PK, 유니크 인덱스, FK, 캐시 키 구조의 일관성을 본다.
- 조회 모델과 저장 모델 경계를 점검한다.

### Hexagonal Reviewer

- `Controller -> WebUseCase -> WebFacade -> Processor -> Presenter` 흐름을 점검한다.
- `application -> adapter` 역참조 여부, Port/Adapter 책임 분리를 점검한다.
- `backend/docs/architecture-guide.md`, `backend/docs/api-design-guide.md`, `backend/docs/coding-conventions.md` 기준으로 검토한다.

### Security Reviewer

- JWT, Resource Server, API Gateway, 인가 정책을 점검한다.
- 외부 헤더 신뢰 여부, 토큰 파싱 위치, 블랙리스트 처리 위치를 검토한다.
- 보안 관련 작업일 때만 선택적으로 포함한다.

## 역할 조합 가이드

### 단일 서비스 기능 추가

- `Backend Leader`
- `Backend Executor`
- `Hexagonal Reviewer`

예:

- `plan-service` API 추가
- `ai-service` 포트 / 프롬프트 리팩토링

### DB / Redis / Query 구조 변경

- `Backend Leader`
- `Backend Executor`
- `DB Reviewer`
- `Hexagonal Reviewer`

예:

- 장소/일정 Entity 추가
- 날씨·혼잡도 캐시 구조 변경
- QueryResult / DTO 대규모 정리

### Security / 인증 구조 변경

- `Backend Leader`
- `Backend Executor`
- `Security Reviewer`
- `Hexagonal Reviewer`

예:

- 카카오 OAuth 흐름 변경
- Resource Server 설정 정리
- Gateway 인증 흐름 리팩토링

### 신규 서비스 또는 대형 리팩토링

- `Backend Leader`
- `Backend Executor`
- `DB Reviewer`
- `Hexagonal Reviewer`
- 필요 시 `Security Reviewer`

예:

- `tour-service` 신규 구축
- `ai-service` 구조 정비
- 외부 API 적재 파이프라인 대형 변경

## 실행 절차

1. Leader가 범위를 고정한다.
   - 무엇을 이번 턴에 끝낼지
   - 무엇은 제외할지
   - 어떤 문서와 컨벤션을 기준으로 볼지

2. 역할별 책임을 나눈다.
   - Executor는 구현
   - Reviewer는 설계 / 컨벤션 / DB / 보안 검토

3. 구현과 검토를 병렬로 진행한다.
   - 구현과 검토가 충돌하지 않도록 책임 범위를 명확히 둔다.

4. Leader가 결과를 취합한다.
   - 검토 의견 중 실제로 반영할 항목을 확정한다.
   - 경계, 네이밍, API, 패키지 구조를 다시 맞춘다.

5. 최종 검증을 수행한다.
   - compile
   - test / check
   - Swagger
   - docs update

6. 최종 보고와 커밋 단위를 정리한다.

## 요청 템플릿

### 범용 템플릿

```text
이번 작업은 멀티 에이전트로 진행해줘.
Backend Leader / Backend Executor / Hexagonal Reviewer 역할로 나눠서
설계, 구현, 검증 후 마지막에 통합 반영해줘.
작업 내용: [여기에 작업 내용]
```

### DB 포함 템플릿

```text
이번 작업은 멀티 에이전트로 진행해줘.
Backend Leader / Backend Executor / DB Reviewer / Hexagonal Reviewer 역할로 나눠서
DB, Redis, Query 구조까지 같이 검토해줘.
작업 내용: [여기에 작업 내용]
```

### 보안 포함 템플릿

```text
이번 작업은 멀티 에이전트로 진행해줘.
Backend Leader / Backend Executor / Security Reviewer / Hexagonal Reviewer 역할로 나눠서
JWT, Resource Server, 인가 경계까지 같이 검토해줘.
작업 내용: [여기에 작업 내용]
```

## 운영 원칙

- 작은 작업에는 멀티 에이전트를 남용하지 않는다.
- 멀티 에이전트라고 해도 최종 책임은 메인 실행자에게 있다.
- 기준 문서는 항상 `backend/docs/*.md`다.
- Reviewer가 구현을 대신하지 않고, Executor가 검토를 생략하지 않는다.
- 커밋 전에는 반드시 `backend/docs/done-checklist.md` 기준으로 최종 점검한다.
