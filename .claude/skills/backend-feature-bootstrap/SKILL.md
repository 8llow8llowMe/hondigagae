---
name: backend-feature-bootstrap
description: 혼디가개 백엔드에 새 서비스 또는 기존 서비스의 새 컨텍스트를 시작할 때 사용한다. architecture-guide / api-design-guide / service-playbook / done-checklist 기준으로 책임·API·패키지 스켈레톤·검증 계획을 묶어 제시한다.
---

# Backend Feature Bootstrap

프로젝트 컨벤션을 건너뛰지 않고 새 백엔드 컨텍스트/서비스를 시작하기 위한 스킬.

## When to Use

- 새 서비스 또는 기존 서비스의 새 컨텍스트를 시작할 때
- 기능의 1차 패키지 스켈레톤과 구현 체크리스트가 필요할 때
- 반복 가능한 백엔드 bootstrap 경로가 필요할 때

## Read First

1. [backend/docs/architecture-guide.md](../../../backend/docs/architecture-guide.md)
2. [backend/docs/api-design-guide.md](../../../backend/docs/api-design-guide.md)
3. [backend/docs/service-playbook.md](../../../backend/docs/service-playbook.md)
4. [backend/docs/done-checklist.md](../../../backend/docs/done-checklist.md)
5. 관련이 있으면 [backend/docs/services/](../../../backend/docs/services/)

## Procedure

1. 책임 정의
   - 서비스/컨텍스트가 소유할 것
   - 경계 밖에 둘 것

2. 공개 인터페이스 정의
   - REST 경로 (복수형·도메인 계층 반영)
   - 인증 정책 (`@PreAuthorize`, Resource Server, JWT claim 기반)
   - request/response 모델 네이밍

3. 패키지 스켈레톤 생성
   ```text
   domainlayer/<context>
     |- adapter
     |  |- in/web { controller, dto/{request,response,item}, presenter }
     |  \- out   { persistence/{entity,repository,*Adapter}, client }
     |- application
     |  |- command, info, mapper, model
     |  |- port/{in,out}
     |  \- service { *WebFacade, processor }
     \- domain/model
   ```

4. 영속성·설정 정의
   - entity / DDL 요구
   - 인덱스·soft delete 전략
   - `@ConfigurationProperties` 필요 여부

5. 외부/내부 연동 (필요 시)
   - 외부 API(TourAPI, 반려동물 동반여행, 두루누비, 기상청, 카카오 등)는 `client` adapter로 캡슐화한다
   - Spring 간 동기 호출은 `FeignClient` 우선
   - `FeignClient -> Adapter -> QueryResult` 패턴 유지

6. 검증
   - Swagger (`@Tag/@Operation/@Schema/@SecurityRequirement`)
   - 트랜잭션 경계
   - compile / test / check
   - docs 갱신 (`service-inventory.md`, 필요 시 `services/*.md`)

## Output Format

```text
BACKEND FEATURE BOOTSTRAP
=========================

Target: [service/context]

Responsibility:
- In:  ...
- Out: ...

Public APIs:
- METHOD /api/v1/...
- auth: ...

Package Skeleton:
- ...

Persistence / Config:
- ...

Internal Integration:
- ... (Feign or 없음)

Verification Plan:
- ...
```
