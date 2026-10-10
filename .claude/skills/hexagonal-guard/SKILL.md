---
name: hexagonal-guard
description: 혼디가개 백엔드의 Hexagonal 계층(Controller/WebUseCase/WebFacade/Processor/Presenter, Port/Adapter) 경계 누수를 점검한다. 계층이 흐릿하거나 port 반환 타입이 상위로 새어나갈 조짐이 보이면 사용한다.
---

# Hexagonal Guard

백엔드의 계층 누수와 헥사고날 경계 파손을 막는 스킬.

## When to Use

- 아키텍처 리뷰나 헥사고날 리팩토링 요청이 있을 때
- 새 컨텍스트 또는 서비스를 추가할 때
- Processor / Adapter / Presenter / Mapper 경계가 흐릿해졌을 때
- Port 반환 타입이나 adapter import가 상위 계층으로 새기 시작했을 때

## Read First

1. [backend/docs/architecture-guide.md](../../../backend/docs/architecture-guide.md)
2. [backend/docs/coding-conventions.md](../../../backend/docs/coding-conventions.md)
3. [backend/docs/service-playbook.md](../../../backend/docs/service-playbook.md)

## What to Check

1. 계층 소유권
   - Controller는 요청/응답 흐름만 오케스트레이션한다
   - WebFacade가 메인 유스케이스 오케스트레이터다
   - Processor는 `Info` 또는 domain model을 반환한다 (Response DTO 금지)
   - Presenter가 유일한 `Info -> Response` 매퍼다

2. Port / Adapter 경계
   - `application`은 `adapter` 타입에 의존하지 않는다
   - out-port는 계약만 노출한다
   - adapter는 JPA/Redis/외부 API 세부를 캡슐화한다
   - 외부 API(TourAPI, 기상청, 카카오 등) 클라이언트 응답 래퍼가 `application`까지 새지 않는다

3. 조회 / 매핑
   - 읽기 경로에서 필요한 경우 `QueryResult`를 사용한다
   - `Info`는 out-port 바깥으로 나가지 않는다
   - Entity ↔ Domain 매핑은 MapStruct를 우선한다

4. 쓰기 흐름
   - 저장은 `domain -> entity -> repository.save -> entity -> domain`을 유지한다
   - ID 생성은 Processor나 명확한 상위 오케스트레이션에서 수행한다

5. 트랜잭션 경계
   - 읽기는 `@Transactional(readOnly = true)`, 쓰기는 `@Transactional`이 적정 위치에 붙어 있다

## Output Format

```text
HEXAGONAL GUARD REPORT
======================

Scope: [context or service]

Boundary Issues:
1. [severity] [file/path]
   - current leak
   - expected boundary
   - recommended refactor

Healthy Patterns:
- [유지할 가치가 있는 패턴]

Next Fix Order:
1. ...
2. ...
```
