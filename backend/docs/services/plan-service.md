# Plan Service

## 책임

- 여행 일정(plan) CRUD — 일자별 항목(장소/식사/숙박/산책/이동) 관리
- 여행 후기 관리 (AI 자동 작성 초안은 ai-service, 저장·공개는 이 서비스)
- 일정 공유 (향후 카카오 메시지 API 연계)

## 컨텍스트

- `plan` — 일정, 일정 항목
- `review` — 여행 후기, 사진

## 도메인 모델 (기획)

- `Plan` — 회원, 대표 반려견(petId), 지역, 기간, 예산, 상태(초안/확정/완료)
- `PlanPet` — 일정에 동행하는 반려견 한 마리 (plan ↔ pet 다대다, `plan_pet`). 첫 행이 `Plan.petId` 와 같다
- `PlanItem` — 일자(day), 순서(sequence), 항목 유형(`PlanItemType`: PLACE/MEAL/LODGING/WALK/MOVE), 대상 참조(placeId 또는 walkCourseId), 메모
- `Review` — 대상 plan, 만족도, 본문, 사진, 방문 장소별 평가(성향 분석 입력)

## 주요 API (계획)

- `GET|POST /api/v1/plans`
- `GET|PUT|DELETE /api/v1/plans/{planId}`
- `PUT /api/v1/plans/{planId}/days/{day}/items` — 일자 단위 항목 일괄 편집
- `GET|POST /api/v1/plans/{planId}/reviews`

## 구현 주의점

- **일정의 소유권은 이 서비스에 있다.** ai-service는 일정안을 생성·제안만 하고, 저장·확정은 이 서비스 API를 통해서만 일어난다.
- AI가 생성한 일정을 저장할 때도 일반 생성과 같은 검증(장소 존재 여부, 날짜 정합성)을 거친다.
  장소 검증은 tour-service 내부 벌크 API(`GET /internal/v1/places/visible-ids`)를 **한 번** 불러
  수행한다 — 항목마다 따로 부르면 저장 한 번에 원격 왕복이 항목 수만큼 생긴다 (coding-conventions §9-7).
  delisted 장소는 존재하지 않는 것으로 오므로, 원천에서 사라진 장소를 새 항목이 참조하는 것도 여기서 막힌다.
- **일정 상세 항목에 장소 요약이 붙는다** (`addr1` · `indoor` · `firstImage` · `lat` · `lng`).
  tour-service 내부 후보 API(`GET /internal/v1/places/candidates`)를 **한 번** 부르고 중복
  아이디는 제거한다 — 프론트가 항목마다 `GET /places/{placeId}` 를 부르던 것을 없애기 위한
  것이라, 같은 문제를 백엔드로 옮기면 의미가 없다.
  - `PlanDetailResponse` 를 내려주는 경로는 **전부** 요약을 붙인다(생성·조회·수정·일자 교체).
    조회에만 붙이면 같은 DTO 가 진입 경로에 따라 주소를 갖거나 안 갖게 되고, 화면은 항목을
    편집한 직후에만 주소가 사라진다.
  - 내부 outline 조회와 응급 브리핑은 요약 없는 `getPlanInfo` 를 쓴다 — 쓰지 않는 원격 호출을
    그 두 경로에 만들지 않는다.
  - **tour-service 장애를 상세 조회 실패로 번지게 하지 않는다.** 요약을 못 받으면 비운 채
    응답한다(즐겨찾기 목록과 같은 판단). 응급 브리핑은 반대로 삼키지 않는다 — 그쪽은 시설
    없는 브리핑이 "가까운 병원이 없다" 는 착각을 준다.
  - **원천에서 사라진(delisted) 장소는 요약만 null 이고 항목은 남는다.** 사용자가 담아 둔 자료다.
  - `indoor` 의 null 은 "실외" 가 아니라 "원천에 정보 없음" 이다. `false` 로 바꾸지 않는다.
- **`targetId` 가 `place.id` 인지의 판정은 `PlanItemType.isPlaceTarget()` 이 갖는다.** 저장 시
  존재 검증과 상세 요약 조회가 같은 집합을 써야 해서 도메인으로 올렸다 — `WALK` 의 `targetId`
  는 `walk_course.id` 라 장소로 조회하면 남의 아이디로 없는 장소를 찾는다.
- `PlanItem`의 다중 대상 FK는 `@Comment`에 분기 기준을 명시한다 (`coding-conventions.md` §9-4).
- 후기 사진 업로드가 필요해지면 `storage-core` 모듈 추가를 검토한다 (`modules.md`).

## 동행 반려견 — 여러 마리 (`plan_pet`)

AI 일정 생성(`POST /ai-plans`)은 `petIds` 로 여러 마리를 받는데 담기(`POST /plans`)가 `petId` 단일이면
"두 마리 기준으로 짠 일정" 이 저장되는 순간 한 마리 일정이 된다. 그래서 담기 계약·저장 구조·판정을 함께 다견화했다.

### 계약 — ai-service 와 같은 규칙

- `PlanCreateRequest.petIds` — `@Size(max = 5)`, 원소 `@Positive`. **첫 번째가 대표 반려견**이다.
- `petIds` 가 있으면 `petId` 는 무시한다. 둘 다 없으면 **대표 반려견**(auth-service `GET /internal/v1/pets/representative/condition`)을
  쓰고, 그것도 없으면 `PLAN_010 PET_REQUIRED` 400 이다 — `plan.pet_id` 가 NOT NULL 이고 날씨 판정의 기준이라 반려견 없는 일정은 만들지 않는다.
- 우선순위를 `AiPlanCreateRequest` 와 똑같이 둔 이유: 두 서비스가 다르게 굴면 프론트가 생성과 담기에서 반려견을 서로 다른 모양으로 실어야 한다.
- 대표 반려견 조회는 **지정이 없을 때만** 부른다. 담기마다 auth-service 를 왕복하지 않는다.
- 응답(`PlanSummaryItem`·`PlanDetailResponse`·내부 `PlanOutlineResponse`)은 `petId`(대표)를 그대로 두고 `petIds`(전체)를 덧붙였다.
  기존 필드를 지우지 않았으므로 프론트는 자기 속도로 옮겨 탄다.

### 저장 구조 — `plan.pet_id` 유지 + `plan_pet` 조인 테이블

두 안 중 **대표 컬럼을 남기는 쪽**을 택했다.

| 안 | 장점 | 문제 |
| --- | --- | --- |
| `plan.pet_id` 제거 + `plan_pet` 만 | 정규화가 깨끗하다 | NOT NULL 컬럼을 지우는 수동 SQL 이 dev/prod 모두 필요하고, 배포 순서를 맞춰야 하며, 응답 `petId` 가 사라져 프론트 동시 수정이 필요하다 |
| **`plan.pet_id` 유지(대표) + `plan_pet`** | 옛 행을 옮기는 SQL 없이 배포된다. 응답 `petId` 가 남아 프론트가 깨지지 않는다 | 두 곳에 같은 사실이 있다 — 규칙(`pet_id` = `plan_pet` 첫 행)을 코드가 지켜야 한다 |

- `plan_pet(id, plan_id, pet_id)` — `uk_plan_pet_plan_id_pet_id`, `idx_plan_pet_pet_id_plan_id`(반려견별 히스토리용). PK 는 Snowflake, 연관관계 어노테이션 없음(§9-1).
- **옛 일정 읽기 규칙은 `Plan.resolvePetIds()` 한 곳에 있다.** `plan_pet` 에 행이 없으면 `[petId]` 로 읽는다. 상세·목록·날씨 판정이 전부 이 메서드를 거치므로 옛 일정을 서로 다르게 읽지 않는다.
- 목록은 페이지의 `planId` 를 모아 **`in` 절 한 번**으로 `plan_pet` 을 읽는다 (§9-7).
- `PUT /plans/{planId}` 로 동행 반려견을 바꾸는 경로는 아직 없다 — 기존에도 `petId` 수정이 없었다. 필요해지면 별도 이슈다.

### 반려견 지정 규칙은 ai-service 와 함께 고친다 (필수)

`PlanCreateRequest.petIds` 와 `AiPlanCreateRequest.petIds` 는 **같은 규칙을 쓴다** — 최대 5마리,
첫 번째가 대표, `petId` 는 `petIds` 가 있으면 무시, 둘 다 없으면 대표 반려견 폴백.
`effectivePetIds()` 구현이 두 파일에 같은 모양으로 들어 있다.

**한쪽만 고치면 프론트가 생성과 담기에서 반려견을 서로 다른 모양으로 실어야 한다.**
실제로 그런 일이 있었다 — 원소 `@NotNull` 이 빠져 `[null]` 이 통과했고, plan-service 는
저장에서 500, ai-service 는 조용히 폴백으로 갈렸다. 어느 쪽도 문서화된 정책이 아니었다.

지정 규칙을 손댈 때는 **두 DTO 와 두 검증 테스트**
(`PlanCreateRequestValidationTest`, `AiPlanCreateRequestValidationTest`)를 함께 본다.

**마이그레이션**

- local/dev(`ddl-auto: update`) — 기동 시 `plan_pet` 이 만들어진다. 옛 행은 그대로 두면 된다.
- prod(`ddl-auto: none`) — 배포 전에 테이블을 만든다. 옛 행 이관 SQL 은 **필요 없다** (읽기 규칙이 대신한다). 원하면 아래로 채울 수 있지만 선택이다.

```sql
CREATE TABLE plan_pet (
    id          BIGINT       NOT NULL COMMENT '일정 동행 반려견 아이디',
    plan_id     BIGINT       NOT NULL COMMENT '여행 일정 아이디 (FK: plan.id)',
    pet_id      BIGINT       NOT NULL COMMENT '반려견 아이디 (FK: pet.id)',
    created_at  TIMESTAMP    NOT NULL COMMENT '생성 날짜',
    updated_at  TIMESTAMP    NOT NULL COMMENT '수정 날짜',
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_pet_plan_id_pet_id (plan_id, pet_id),
    KEY idx_plan_pet_pet_id_plan_id (pet_id, plan_id)
) COMMENT = '여행 일정 동행 반려견';

-- 선택: 옛 일정을 조인 테이블에도 남기고 싶을 때. 한 일정에 한 행이라 plan.id 를 PK 로 재사용해도 겹치지 않는다.
INSERT INTO plan_pet (id, plan_id, pet_id, created_at, updated_at)
SELECT p.id, p.id, p.pet_id, p.created_at, p.updated_at
FROM plan p
WHERE NOT EXISTS (SELECT 1 FROM plan_pet pp WHERE pp.plan_id = p.id);
```

### 반려견별 히스토리 (`GET /plans?petId=`)

**한 마리라도 동행이면 히트**다. `plan.pet_id = :petId OR plan.id IN (select plan_id from plan_pet where pet_id = :petId)` —
조인 테이블만 보면 옛 일정이, 대표 컬럼만 보면 두 번째 이후 반려견이 히스토리에서 빠진다. 정적 JPQL 이라 H2 슬라이스 테스트(`PlanRepositoryTest`)로 고정했다.

### 판정 축 — 아이별로 따로 판정하고, 점수가 가장 낮은 아이가 기준

여러 마리를 어떻게 합칠지는 두 갈래였다.

| 안 | 호출 | 문제 |
| --- | --- | --- |
| 조건을 보수적으로 합쳐 한 번 판정 (더위·추위·소음 민감 OR, 크기 최대) | 일수 × 1 | **존재하지 않는 가상의 개** 기준이 된다. 가장 큰 아이가 더위에 가장 약한 아이라는 보장이 없고, 견종(단두종) 축은 합칠 방법이 없다 |
| **아이별로 따로 판정 → 점수가 가장 낮은 아이를 그날의 기준** | 일수 × 서로 다른 조건 수(≤5) | 호출이 늘지만 "몽실이 기준" 이라고 말할 수 있다. 실제 아이 기준이라 근거가 정직하다 |

- 조건이 같은 아이들은 **한 번만 묻는다** — 특성 조회에 실패해 전부 일반 조건이 됐을 때 마리 수만큼 같은 질문을 반복하지 않는다.
- 응답은 일자마다 `basisPetId`(기준 아이)와 `petSuitabilities[]`(아이별 점수·등급)를 내린다. `score`·`reasons`·`indoorAlternatives` 는 기준 아이 것이다 — 날씨는 아이마다 같고, 근거를 마리 수만큼 반복하면 응답이 읽기 어려워진다.
- 점수를 못 낸(예보 밖) 날은 첫 아이(대표)를 기준으로 두어 날씨·이유는 보여 준다. 모든 조회가 실패하면 `unavailableReason` 이고 아이별 목록은 빈 배열이다.
- 반려견 특성은 auth-service 벌크 내부 API(`GET /internal/v1/pets/conditions?memberId=&petIds=`) 한 번으로 받는다. 빠진 아이(소유 아님·조회 실패)는 일반 조건으로 그 아이 몫의 판정에 남는다.
- 후기 데이터는 반려견 성향 분석(ai-service)의 입력이 되므로, 방문 장소·활동 유형·만족도가 구조화되어 저장되어야 한다.

## 일정 날씨 브리핑 (`GET /api/v1/plans/{planId}/weather`)

- 적합도를 **다시 계산하지 않는다.** 판정 규칙의 소유자는 tour-service 고, 같은 규칙을
  두 곳에서 구현하면 일정 화면과 장소 화면이 같은 날 같은 곳을 다르게 말하게 된다.
- 반려견 특성은 auth-service 내부 벌크 API(`GET /internal/v1/pets/conditions`)에서 받아
  tour-service 에 파라미터로 넘긴다. 사본을 두면 사용자가 프로필을 고쳐도 옛 값으로 판정한다.
- **여러 마리면 아이별로 따로 판정하고 점수가 가장 낮은 아이가 그날의 기준이다** — 위 "동행 반려견" 절의 판정 축 참고.
- **일자마다 대표 장소 한 곳만 조회한다.** 항목마다 부르면 3박 4일 일정에 열 번 넘는 원격
  호출이 생긴다. 하루 안의 항목들은 대개 같은 격자에 들어가 날씨가 거의 같으므로,
  "그날 우산 필요한가"에는 대표 한 곳이면 답이 된다. 대표는 그날 가장 이른 장소성 항목이다.
- 일자별로 `unavailableReason` 을 따로 둔다. 어떤 날은 예보가 닿고 어떤 날은 닿지 않는 것이
  **정상**이라(예보는 약 11일), 전체를 성공/실패로 나누면 그 차이를 표현할 수 없다.
- 날씨 때문에 항목을 바꾸는 것은 이 API 가 아니라 일자별 항목 교체 API 로 명시적으로 한다
  (`api-design-guide.md` §8 의 부수효과 분리 원칙).
- Feign 조회 실패는 예외로 올리지 않고 빈 값으로 바꾼다. 날씨는 부가 정보이고,
  tour-service 가 흔들렸다고 사용자가 자기 일정을 못 보게 되면 안 된다.
- 항목 단위 판정이 필요해지는 순간은 **산책 위험도**다. 그것은 시각에 따라 갈리므로 같은
  방식으로 접을 수 없고, 별도 조회 설계가 필요하다.

## 여행 동행 기능

- `PUT /api/v1/plans/{planId}/items/{planItemId}/visited` — 항목 방문 체크. 일차 항목을
  교체(delete+insert)하면 새 항목이라 그 날의 체크는 초기화된다.
- `GET /api/v1/plans/{planId}/emergency` — 일자별 방문 장소마다 가까운 동물병원·동물약국
  (반경 10km, 최대 3곳). 같은 장소는 한 번만 검색하고, 좌표가 없는 장소는 건너뛴다 — 원천에서
  사라진(delisted) 장소는 요약 자체가 오지 않고, 남아 있어도 원천이 좌표를 주지 않은 장소가 있다.
  시설 검색 실패는 삼키지 않는다 — 시설 없는 브리핑은 안전하다는 착각만 준다.
- `GET /api/v1/plans?petId=` — 반려견별 여행 히스토리. 여러 마리 일정은 그중 한 마리로 들어 있어도 히트다.
  or-null 조건 대신 메서드를 나눠 조회한다.

## 장소 즐겨찾기 (favorite 컨텍스트)

- `GET|POST|DELETE /api/v1/favorites/places[/{placeId}]` — 찜 목록/저장/해제. 저장·해제 모두
  멱등이고 회원당 최대 100곳이다. 저장 시 tour-service 조회로 장소 존재를 검증한다.
- 목록의 장소 요약(제목·주소·동반조건·대표 이미지)은 tour-service 내부 후보 API 로 붙인다.
  조회 실패 시 placeId 만으로 응답한다 — tour 장애가 찜 목록 조회 실패로 번지지 않는다.

## 서비스 간 내부 API

`GET /internal/v1/plans/{planId}/outline?memberId=` — ai-service 의 하루 재생성용 일정 개요.
`GET /internal/v1/favorites/place-ids?memberId=` — ai-service 의 즐겨찾기 우선 반영용 아이디 목록.

- 일차별 항목의 제목·유형·placeId 만 내보낸다. 메모·시간대 같은 개인 기록은 경계를 넘기지 않는다.
- `petId`(대표)와 `petIds`(동행 전체)를 함께 내보낸다. ai-service 의 준비물 생성은 아직 `petId` 만 읽는다 — 다견 준비물은 ai 쪽 후속이다.
- 내부 호출이라도 memberId 로 소유권을 다시 확인한다 — 남의 planId 로는 404.
