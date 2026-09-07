---
name: backend-api-check
description: 혼디가개 백엔드 REST API(경로, Swagger, Response 래퍼, Presenter 흐름)가 backend/docs 규칙을 따르는지 점검할 때 사용한다. Controller/DTO/Presenter 변경이나 PR 직전 Swagger 커버리지 확인이 트리거다.
---

# Backend API Check

혼디가개 백엔드 API 구현이 `backend/docs` 규칙과 일치하는지 점검하는 스킬.

## When to Use

- 사용자가 백엔드 API 설계 리뷰/정리를 요청할 때
- Controller, request/response DTO, Presenter를 추가·수정했을 때
- REST 경로 일관성을 재확인하고 싶을 때
- PR 직전 Swagger 커버리지를 점검하고 싶을 때

## Read First

판단 전에 아래 문서를 먼저 연다.

1. [backend/docs/api-design-guide.md](../../../backend/docs/api-design-guide.md)
2. [backend/docs/coding-conventions.md](../../../backend/docs/coding-conventions.md)
3. [backend/docs/done-checklist.md](../../../backend/docs/done-checklist.md)

## What to Check

1. 경로 설계
   - 리소스는 복수형을 사용하고 도메인 의미가 드러난다
   - 중첩 깊이가 도메인 계층을 반영한다
   - 비교/요약 엔드포인트도 리소스 체인 안에서 자연스럽게 읽힌다

2. Controller 흐름
   - Controller는 `*WebUseCase`만 호출한다
   - 메서드 네이밍이 유스케이스와 맞는다
   - 응답은 `ResponseEntity<Response<T>>` 형태다

3. 응답 설계
   - 내부 `Info`가 외부로 바로 노출되지 않는다
   - 중첩 응답 조합은 Presenter가 담당한다
   - 무한 스크롤이 맞는 영역은 `SliceResponse`를 사용한다

4. Swagger 커버리지
   - `@Tag`, `@Operation`, `@Parameter`, `@Schema` 작성
   - 설명은 한국어 기본
   - 인증 필요한 API는 `@SecurityRequirement` 명시
   - 내부 전용 API는 `@Hidden` 검토

5. Enum metadata
   - 응답 DTO에서는 enum metadata를 가능한 한 별도 객체로 묶는다
   - metadata 객체 내부에서는 `code`, `name`, `description`을 기본으로 쓰고, 점수 해석이 필요할 때만 `scoreDescription`을 추가한다

## Output Format

```text
BACKEND API CHECK
=================

Scope: [controller or feature]

Findings:
1. [severity] [file/path]
   - issue
   - expected rule
   - recommended fix

Confirmed:
- [이미 규칙에 맞는 항목]

Residual Risk:
- [없거나 짧은 메모]
```
