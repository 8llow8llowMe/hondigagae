# [BE] feat: 여행 준비물 저장·조회 API

> 이슈: [#398](https://github.com/8llow8llowMe/hondigagae/issues/398)
> 상태: 구현 완료
> 대상: plan-service `plan` 컨텍스트 (ai-service 는 손대지 않는다)

## 무엇이 문제였나

준비물 관련 엔드포인트가 **생성 하나뿐**이었다.

```text
POST /api/v1/ai-plans/packing-list/{planId}   → PackingListResponse
```

저장이 없으니 화면을 떠나면 결과가 사라진다. 다시 보려면 LLM 을 한 번 더 돌려야 하고,
같은 일정인데 매번 다른 목록이 나온다. FE 는 그 사실을 "저장되지 않아요" 문구로 덮고 있었다
(`plan-packing-list.tsx` 의 `useMutation` 주석 — "결과가 저장되지 않아 조회로 캐시할 것이 없다").

## 어느 서비스가 갖는가 — plan-service

**ai-service 가 아니라 plan-service 다.** 두 근거가 같은 방향을 가리킨다.

- `service-inventory.md` — "**일정의 소유권은 이 서비스(plan-service)에 있다.** ai-service 는
  제안만 하고 저장·확정은 여기서만 일어난다." 준비물은 일정에 매달린 자료이므로 같은 규칙을 받는다.
- ai-service 는 **JPA 가 없다.** Redis 만 쓴다(`service-inventory.md`). 저장소를 새로 붙이면
  "제안만 하는 서비스" 라는 성격 자체가 바뀐다.

`AiLlmPort.generatePackingList` 의 주석("일정 초안과 같은 '제안' 지위다 — 저장하지 않는다")도
그대로 유효하다. ai-service 는 이 이슈에서 **한 줄도 바뀌지 않는다.**

### `plan` 컨텍스트 안에 둔다 (`favorite` 처럼 새 컨텍스트로 빼지 않는다)

준비물은 `/api/v1/plans/{planId}` 아래의 **하위 리소스**라 소유권 검사가 일정의 것과 같아야 한다.
새 컨텍스트로 빼면 `PlanQueryProcessor.getOwnedPlan` 을 복제하거나 컨텍스트를 가로질러 부르게 된다.
`favorite` 은 일정의 하위 리소스가 아니라서 갈라져 있는 것이고, `plan_item` · `plan_pet` 은
같은 이유로 `plan` 안에 있다 — 준비물은 뒤쪽과 같은 부류다.

컨트롤러만 `PlanPackingWebController` 로 나눈다. `PlanWebController` 가 이미 엔드포인트 10개라
여기에 5개를 더하면 한 파일이 읽기 어려워진다.

## 이슈가 BE 에 맡긴 판단

| 이슈 항목 | 판단 | 근거 |
| --- | --- | --- |
| 재생성하면 덮어쓸지 이력을 남길지 | **덮어쓴다.** 이력 없음 | 준비물의 재생성은 "다시 뽑기" 이지 버전 관리가 아니다. 이력을 남기면 어느 것이 지금 목록인지 고르는 UI 가 따라붙는데, 짐 싸는 화면에 그 선택지는 값어치가 없다 |
| 항목별 체크 상태 | **넣는다** | 준비물의 실사용은 "짐 쌀 때 하나씩 지우는 것" 이다. 이게 없으면 저장이 절반만 쓸모 있다 |
| 사용자 항목 추가·삭제 | **넣는다** | AI 결과를 손보는 흐름. 추가가 없으면 사용자는 AI 가 빠뜨린 것을 적어 둘 데가 없다 |
| 소유자 검증 | plan-service 가 이미 갖고 있다 | `getOwnedPlan` 하나를 그대로 쓴다 — 없거나 남의 것이면 똑같이 404 |

## 재생성 규칙 — 이 기능의 진짜 설계

저장이 붙는 순간 "다시 뽑기" 가 **파괴적 연산**이 된다. 네 가지를 지킨다.

### 1. AI 항목만 교체한다. 사용자가 넣은 항목은 남는다

`PUT` 은 `source = AI` 인 행만 지우고 새로 넣는다. `source = USER` 는 건드리지 않는다.

사용자가 직접 적어 둔 것을 AI 재생성이 말없이 지우면 안 된다. 이 저장소는 같은 판단을 이미 한 번
했다 — 기간을 줄일 때 범위 밖 항목을 자동 삭제하지 않고 `PLAN_008` 로 거부한다
(`plan-service.md`: "사용자가 담아 둔 기록을 말없이 지우는 일이고, 되돌릴 수단도 없다").

### 2. 체크 상태를 이름으로 승계한다

교체 전 목록에 같은 `name` 이 있고 체크돼 있었으면, 새 항목도 체크된 채로 들어간다.

이게 없으면 짐을 반쯤 싸 둔 상태에서 "다시 뽑기" 를 한 번 누르는 순간 체크가 전부 날아간다.
`plan_item` 의 `visited` 는 일자 교체 때 초기화되는데(그쪽은 항목이 통째로 다른 것이 되므로 맞다),
준비물은 "리드줄" 이 다시 나오면 **같은 리드줄**이다. 두 경우를 같게 다루면 안 된다.

### 3. 이름이 겹치면 사용자 것이 이긴다

`uk_plan_packing_item_plan_id_name` 이 있어 같은 이름이 두 줄로 서지 않는다.

- USER 항목과 이름이 겹치는 AI 항목은 **버린다.**
- AI 목록 안에서 이름이 겹치면 **첫 것만** 남긴다 (LLM 이 같은 것을 두 번 낼 수 있다).

#### 이름 비교는 DB 콜레이션과 같은 규칙이어야 한다

DB 콜레이션은 `utf8mb4_unicode_ci` 다 (`docker-compose-local.yml`). **대소문자·악센트 무시 +
PAD SPACE** 라 `"리드줄"` 과 `"리드줄 "`, `"Poop Bag"` 과 `"poop bag"` 이 유니크 인덱스 상 같은 값이다.
앱이 `String.equals` 로 판정하면 두 규칙이 갈려 **앱이 통과시킨 것을 MySQL 이 거절한다** — 500 이 나고,
PUT 이면 트랜잭션이 통째로 롤백돼 수십 초 걸린 LLM 결과가 날아간다.

`PlanPackingProcessor.nameKey(name)` = `name.trim().toLowerCase(Locale.ROOT)` 로 중복을 판정한다.
사용자 항목 충돌·AI 목록 내 중복·체크 상태 승계·직접 추가 검사가 **전부 이 키를 쓴다.**
**저장하는 `name` 은 원문 그대로 둔다** — 겹치는지만 같은 규칙으로 보면 되지 사용자가 적은 표기를
고쳐 쓸 이유는 없다.

마지막 방어선으로 저장 구간을 `DataIntegrityViolationException` → `PACKING_ITEM_NAME_DUPLICATED`(409)
로 감싼다 (`FavoriteCommandProcessor.add` 와 같은 방식). 검사와 INSERT 사이에 같은 이름이 들어오는
동시 요청(PUT 이 LLM 결과를 저장하는 사이 POST) 에서도 500 대신 409 가 나간다.

이게 실제로 동작하려면 **어댑터가 저장하면서 flush 해야 한다.** 트랜잭션은 Facade 에 걸려 있고
`saveAll`/`save` 는 flush 하지 않으므로, 그냥 두면 INSERT 가 커밋 시점까지 밀려 위반이 Processor 의
`try` 밖에서 터진다 — 잡으려던 예외가 그대로 500 으로 나간다. `PlanPackingItemRepositoryAdapter` 는
`saveAllAndFlush`/`saveAndFlush` 를 쓴다. 트랜잭션 끝에서 어차피 나갈 쓰기라 추가 비용은 없다.

### 4. 표시 순서는 재생성마다 다시 매긴다

AI 는 0..n-1 로 다시 매기고, **살아남은 USER 항목을 그 뒤로(n, n+1, ...) 다시 매겨 함께 저장한다.**
USER 항목의 상대 순서는 기존 `sortOrder` 오름차순을 유지하고, **내용·체크 상태는 건드리지 않는다.**

USER 항목의 `sortOrder` 는 추가 시점의 `max + 1` 이라 그대로 두면 새 AI 목록과 겹친다 — AI 10개 뒤에
사용자가 추가(10)하고 다시 뽑아 12개가 오면 `sort_order = 10` 이 둘이 된다. `ORDER BY sort_order` 는
동순위 순서를 보장하지 않아 PUT 응답 순서와 직후 GET 순서가 갈리고, 맨 뒤에 적어 둔 항목이 AI 목록
한가운데로 끼어든다.

조회 정렬도 `findByPlanIdOrderBySortOrderAscIdAsc` 로 아이디 tie-break 을 건다. 응답을 만드는
`PlanPackingProcessor` 의 비교자도 `sortOrder → id` 로 **같은 규칙**이다 — 한쪽만 tie-break 이 없으면
두 경로의 순서가 갈린다.

### 삭제는 벌크 DML 로 즉시 나가야 한다

`plan_item` 이 겪은 것과 같은 함정이다. 파생 delete 는 `em.remove` 큐잉이라 flush 때 INSERT 가
DELETE 보다 먼저 나간다. 교체가 같은 `(planId, name)` 을 재사용하므로 옛 행이 남은 채 INSERT 되어
유니크 인덱스 위반으로 죽는다. `@Modifying @Query` 로 즉시 지운다.

둘 다 `@Modifying(clearAutomatically = true)` 다 (저장소에서 이 옵션을 쓰는 첫 자리). 벌크 JPQL 은
영속성 컨텍스트를 건드리지 않아 **지운 행이 1차 캐시에 유령으로 남는다** — 끄고 두면 같은 트랜잭션에서
`findById` 가 지운 행을 그대로 돌려준다. 지금은 삭제 이후 도메인 record 만 쓰므로 새지 않지만,
"삭제 후 갱신된 목록을 돌려준다" 로 API 를 바꾸는 순간 샌다. 컨텍스트 **전체**가 detach 되는 것은
이 유스케이스에 무해하고, 대신 이 호출 앞에 flush 되지 않은 쓰기를 쌓아 두면 안 된다.

## 테이블 — `plan_packing_item`

| 컬럼 | 타입 | Null | 설명 |
| --- | --- | --- | --- |
| id | BIGINT | N | PK (Snowflake, 애플리케이션이 채운다) |
| plan_id | BIGINT | N | FK: plan.id |
| category | VARCHAR(30) | N | 필수 / 날씨 대비 / 반려견 케어 / 이동 (LLM 이 내는 4종. 문자열로 받는다 — 아래) |
| name | VARCHAR(100) | N | 준비물 이름 |
| reason | VARCHAR(500) | Y | 이 여행 데이터 기반의 이유. **USER 항목은 null** |
| source | VARCHAR(10) | N | enum `PackingItemSource`: AI / USER |
| checked | BIT(1) | N | 챙겼는지. default false (엔티티가 primitive boolean 이라 Hibernate 6 가 `bit(1)` 로 만든다) |
| sort_order | INT | N | 표시 순서 (0부터). **재생성마다 AI → USER 순으로 다시 매긴다** |
| created_at / updated_at | DATETIME | N | `BaseEntity` |

```text
uk_plan_packing_item_plan_id_name         (planId, name)
idx_plan_packing_item_plan_id_sort_order  (planId, sortOrder)
```

- 연관관계 어노테이션 없음, raw FK 만 (`coding-conventions.md` §9-1).
- **`category` 를 enum 으로 굳히지 않는다.** 값의 원천이 LLM 이라 프롬프트를 고치면 늘어난다.
  enum 으로 두면 모델이 새 분류를 낸 날 저장이 통째로 실패한다 — 준비물 목록 하나 때문에
  그럴 값어치가 없다. 길이 상한(30자)만 건다.
- 상한은 일정당 **50개**. AI 가 8~15개를 내므로 사용자가 30개 넘게 덧붙이는 경우를 위한 방어다.

### 마이그레이션

- local/dev (`ddl-auto: update`) — 기동 시 만들어진다.
- prod (`ddl-auto: none`) — 배포 전에 아래를 적용한다. 옮길 옛 행은 없다 (새 테이블).

```sql
CREATE TABLE plan_packing_item (
    id          BIGINT       NOT NULL COMMENT '준비물 항목 아이디',
    plan_id     BIGINT       NOT NULL COMMENT '여행 일정 아이디 (FK: plan.id)',
    category    VARCHAR(30)  NOT NULL COMMENT '준비물 분류',
    name        VARCHAR(100) NOT NULL COMMENT '준비물 이름',
    reason      VARCHAR(500)          COMMENT '이 여행 데이터 기반의 준비 이유 (사용자 추가 항목은 없음)',
    source      VARCHAR(10)  NOT NULL COMMENT '출처 (AI: AI 추천, USER: 사용자 추가)',
    checked     BIT(1)       NOT NULL COMMENT '챙김 체크',
    sort_order  INT          NOT NULL COMMENT '표시 순서 (0부터)',
    created_at  TIMESTAMP    NOT NULL COMMENT '생성 날짜',
    updated_at  TIMESTAMP    NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_packing_item_plan_id_name (plan_id, name),
    KEY idx_plan_packing_item_plan_id_sort_order (plan_id, sort_order)
) COMMENT = '여행 일정 준비물 항목';
```

- `checked` 는 `BIT(1)` 이다. 엔티티가 primitive `boolean` 이라 Hibernate 6 이 `bit(1)` 로 만든다 —
  문서에 `BOOLEAN` 으로 적어 두면 prod 스키마가 `ddl-auto: update` 로 만든 dev 스키마와 갈린다.
- 스키마 콜레이션은 `utf8mb4_unicode_ci` 를 전제로 한다. `uk_plan_packing_item_plan_id_name` 의
  같음 판정이 여기서 나오고, 애플리케이션의 중복 판정(`nameKey`)이 그 규칙에 맞춰져 있다.
  콜레이션을 `utf8mb4_bin` 같은 것으로 바꾸면 **앱이 막던 것을 DB 가 통과시켜** 같은 이름이 두 줄로 선다.

## API

전부 `@PreAuthorize("isAuthenticated()")` + `@AuthenticationPrincipal MemberLoginActive` 이고,
일정이 없거나 남의 것이면 **똑같이 404 `PLAN_001`** 이다 (존재 자체를 노출하지 않는다).

| 메서드 | 경로 | 용도 |
| --- | --- | --- |
| GET | `/api/v1/plans/{planId}/packing-items` | 저장된 준비물 조회 |
| PUT | `/api/v1/plans/{planId}/packing-items` | AI 생성 결과 저장 (**AI 항목만 교체**) |
| POST | `/api/v1/plans/{planId}/packing-items` | 항목 직접 추가 (`source = USER`) |
| PUT | `/api/v1/plans/{planId}/packing-items/{packingItemId}/checked` | 체크 / 해제 |
| DELETE | `/api/v1/plans/{planId}/packing-items/{packingItemId}` | 항목 삭제 |

체크 경로를 `PATCH` 가 아니라 `PUT .../checked` 로 둔 것은 방문 체크
(`PUT /plans/{planId}/items/{planItemId}/visited`) 와 같은 모양을 쓰기 위해서다.

### 응답 — `PlanPackingListResponse`

```json
{
  "planId": "1234567890123456789",
  "items": [
    {
      "packingItemId": "1234567890123456790",
      "category": "반려견 케어",
      "name": "리드줄",
      "reason": "숲길 코스가 이틀 들어 있어 목줄 착용 구간이 깁니다.",
      "source": { "code": "AI", "name": "AI 추천", "description": "AI 가 이 여행의 일정·날씨·반려견 특성을 근거로 제안한 항목입니다." },
      "checked": false,
      "sortOrder": 0
    }
  ],
  "totalCount": 12,
  "checkedCount": 3,
  "generatedAt": "2026-09-11T14:02:11"
}
```

- `source` 는 enum metadata 객체다 (`coding-conventions.md` §11).
- `generatedAt` 은 **AI 항목 중 가장 최근 `createdAt`** 이다. AI 항목이 없으면 null.
  "이 목록이 언제 뽑힌 것인가" 는 매번 다른 결과가 나오는 기능에서 사용자가 물을 수밖에 없는 것이다.
- `totalCount` 는 자를 일이 없는 전량 조회라 `items.size()` 가 곧 총계다
  (`api-design-guide.md` §5-1 의 "그대로 둔다" 쪽).

### FE 흐름

```text
일정 상세 진입
  → GET /plans/{id}/packing-items
      items 가 있으면 → 그대로 그린다 (LLM 을 돌리지 않는다)
      items 가 비어 있으면 → "만들기" 버튼
          → POST /ai-plans/packing-list/{id}   (ai-service, 수십 초)
          → PUT  /plans/{id}/packing-items      (결과 저장)
체크 → PUT /plans/{id}/packing-items/{itemId}/checked
```

**저장을 ai-service 가 대신 하지 않는다.** ai-service 가 plan-service 를 불러 저장하면
"제안만 한다" 는 경계가 무너지고, 생성은 됐는데 저장이 실패한 상태를 ai-service 가 떠안게 된다.
FE 가 두 번 부르면 그 실패가 각각 어디서 났는지 화면이 구분할 수 있다.

## 에러 코드

도메인 3종을 `PlanErrorCode` 에 더한다.

| 코드 | 이름 | HTTP | 언제 |
| --- | --- | --- | --- |
| PLAN_012 | PACKING_ITEM_NAME_DUPLICATED | 409 | 직접 추가할 때 같은 이름이 이미 있다 |
| PLAN_013 | PACKING_ITEM_LIMIT_EXCEEDED | 400 | 일정당 50개를 넘긴다 |
| PLAN_014 | NOT_FOUND_PACKING_ITEM | 404 | 그 일정의 준비물 항목이 아니다 |

필드 검증 코드는 `PlanValidationMessage` 에 `PLAN_116` 부터 잇고, 프레임워크 공통 2종
(`PARAMETER_TYPE_INVALID` · `PARAMETER_REQUIRED`)은 `coding-conventions.md` §8-2 대로
**대역 끝으로 민다** (`PLAN_116`/`PLAN_117` → `PLAN_124`/`PLAN_125`).
`petIds` 가 `PLAN_115` 를 쓰면서 한 번 밀었던 것과 같은 이동이고, FE 가 참조하는 것은
`PLAN_101`~`PLAN_107`·`PLAN_114` 뿐이라 이번 이동에 걸리는 곳은 없다.

## 남은 것

- **다견 준비물.** ai-service 의 준비물 생성은 아직 `petId`(대표) 하나만 읽는다
  (`plan-service.md` 내부 API 절). 저장 구조는 마리 수와 무관하므로 이 이슈에서는 손대지 않는다.
- **FE 연동.** 이 이슈는 API 까지다. 화면이 `useMutation` 에서 `useQuery` + 저장으로 옮겨 타는 것은
  별도 이슈다 — 지금 FE 에 있는 "저장되지 않아요" 문구도 그때 걷는다.
