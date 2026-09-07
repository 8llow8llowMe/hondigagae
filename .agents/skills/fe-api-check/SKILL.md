---
name: fe-api-check
description: 혼디가개 프론트엔드의 API 호출부·타입이 로컬 백엔드 Swagger 계약과 일치하는지 점검할 때 사용한다. 새 API 연동, 백엔드 동기화 직후, PR 직전 계약 드리프트 확인이 트리거다.
---

# FE API Check

FE 호출부가 백엔드 계약과 어긋나지 않았는지 점검하는 스킬.

## When to Use

- 새 API를 연동했거나 응답 타입을 바꿨을 때
- 백엔드 `develop` 동기화 직후
- "이 엔드포인트 아직 살아있나" 의심될 때
- PR 직전 계약 드리프트 점검

## Read First

1. [frontend/docs/api-integration-guide.md](../../../frontend/docs/api-integration-guide.md)
2. [backend/docs/service-inventory.md](../../../backend/docs/service-inventory.md) — **미착수 API 목록**
3. [backend/docs/api-design-guide.md](../../../backend/docs/api-design-guide.md)

## Procedure

1. **계약 정본 확보** — 로컬 Swagger가 정본이다. 스냅샷·문서로 대체 판정하지 않는다.
   ```bash
   curl -s --max-time 10 http://localhost:8000/v3/api-docs   # 게이트웨이 집계
   curl -s --max-time 10 http://localhost:8081/v3/api-docs   # auth
   curl -s --max-time 10 http://localhost:8082/v3/api-docs   # tour
   curl -s --max-time 10 http://localhost:8083/v3/api-docs   # plan
   curl -s --max-time 10 http://localhost:8085/v3/api-docs   # ai
   ```
   **백엔드 미기동이면 "확인 불가"로 보고하고 끝낸다.**

2. **FE 호출부 수집**
   ```bash
   grep -rn "'/\|\"/" frontend/src/lib/api/*.ts | grep -v "^.*://"
   ```
   `src/lib/api/*.ts` 경로 문자열, `src/types/*.ts` 응답 타입.

3. **BFF 매핑 적용** — FE의 `/places/...` 는 실제로 `/api/v1/places/...` 다.

4. **경로 존재 여부 우선 확인** — Swagger에 없으면 그 기능은 죽어 있다. `service-inventory.md` 와 대조해 **미구현인지 오타인지** 구분한다.

5. **필드 단위 대조** — 이름, 타입, `required`, `nullable`, `enum`, 배열 여부, 쿼리 파라미터 필수/기본값/범위.

6. **실호출로 확증** — 인증 불필요 GET만.
   ```bash
   curl -s --max-time 15 "http://localhost:8000/api/v1/places" | python3 -m json.tool --no-ensure-ascii | head -40
   ```
   **저장·수정·삭제(POST/PUT/PATCH/DELETE)는 절대 호출하지 않는다.**

7. **이 프로젝트 고빈도 항목 점검**
   - 백엔드 미착수 기능 호출부가 있는가 (**최우선**)
   - `memberId` 를 `number` 로 타이핑했는가
   - `resultMessage` 를 `string` 으로 타이핑했는가 (백엔드 타입은 `Object`)
   - 비동기 job의 `status=FAILED`(HTTP 200) 를 실패로 처리하는가
   - `SliceResponse` 를 `{contents, hasNext}` 로 다루는가
   - enum 코드→한국어 매핑 테이블이 FE에 있는가
   - nullable을 non-null로 가정했는가
   - 단위가 맞는가 (℃ / m·km / 원 / 분)

## Output Format

```text
FE API CHECK
============

확인 범위: [파일/기능]
Swagger 확인: [URL] / [일시]  또는  확인 불가 (이유)

발견 (심각도 순):
1. 위치     : frontend/src/...:행
   FE 현재   : ...
   계약 실제 : ...
   증거     : [호출 URL + 응답 발췌]
   영향     : ...
   수정 방향 : ...

불일치 없음: [확인한 범위 명시]
미확인 범위: [...]
```
