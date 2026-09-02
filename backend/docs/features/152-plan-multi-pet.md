# [BE] feat: 담기·판정의 다견화 — `PlanCreateRequest.petIds` 와 아이별 날씨 판정

> 이슈 #152. 본문 원문은 GitHub 에 있다. 여기에는 **착수 시점의 실측과 설계 판단**을 남긴다.
> 규칙 정본은 `docs/services/plan-service.md` 의 "동행 반려견" 절이다.

## 어떤 기능인가요? ✏

여러 마리로 만든 AI 일정을 저장할 때 한 마리로 접히는 것을 없앤다. `PlanCreateRequest` 가 `petIds` 를 받고,
저장된 일정의 날씨·적합도 판정도 여러 마리를 함께 본다.

## 착수 시점 실측 (2026-09-02, `develop` 26f1b07)

| 영역 | 상태 |
| --- | --- |
| ai-service 생성 | `AiPlanCreateRequest.petIds`(`@Size(max=5)`, petIds 승 → petId → 대표견), 벌크 특성 조회, 프롬프트 입장제한 문구 — **완비** |
| plan-service | `petIds` 0건. `PlanCreateRequest.petId @NotNull` 단일, `PlanEntity.petId nullable=false`, `PlanWeatherProcessor` 한 마리 조건, 조회 응답 `petId` 단일, `GET /plans?petId=` 단일 equals |
| FE (#128 · PR #151) | 생성은 `petIds` 로 보내고, **담기 직전에 판정 기준 한 마리를 사람이 고른다** (`ai-plan-job-view.tsx` `basisPetId`, 다견선택-세부명세 D4). 자동 선택을 하지 않은 이유는 입장 제한(크기·체중) 축과 날씨 민감도 축이 다르기 때문 |

## 판단이 갈렸던 것

### 1. 저장 구조 — `plan.pet_id` 유지 + `plan_pet`

`pet_id` 를 지우고 조인 테이블만 두는 안은 정규화가 깨끗하지만, NOT NULL 컬럼을 지우는 수동 SQL 이 dev/prod 에 모두 필요하고
응답의 `petId` 가 사라져 프론트를 같이 고쳐야 한다. **대표 컬럼을 남기고**(`petIds` 첫 번째) 전체 목록을 `plan_pet` 에 두면
옛 행을 옮기지 않고 배포할 수 있다 — 옛 일정은 `plan_pet` 이 비어 있으므로 `Plan.resolvePetIds()` 가 `[petId]` 로 읽는다.
두 곳에 같은 사실이 있는 대가는 "첫 행 = 대표" 규칙을 `PlanCommandProcessor` 가 지키는 것으로 갚는다.

### 2. 판정 축 — 아이별로 따로, 점수가 가장 낮은 아이가 기준

조건을 보수적으로 합쳐(민감도 OR, 크기 최대) 한 번만 부르면 호출은 지금과 같지만 **존재하지 않는 가상의 개** 기준이 된다.
견종(단두종) 축은 합칠 방법조차 없다. 아이별로 부르면 호출이 일수 × 조건 수(≤5)로 늘지만 화면이 "몽실이 기준" 이라고
말할 수 있다. 조건이 같은 아이는 한 번만 묻는다 — auth-service 장애로 전부 일반 조건이 됐을 때 마리 수만큼 반복하지 않는다.

### 3. `GET /plans?petId=` 매칭 — 한 마리라도 동행이면 히트

대표 컬럼과 조인 테이블을 **둘 다** 본다. 한쪽만 보면 옛 일정(조인 행 없음) 또는 두 번째 이후 반려견이 히스토리에서 빠진다.

### 4. 검증 코드 대역

`PET_ID_REQUIRED(PLAN_101)` 은 `petId` 가 선택이 되면서 같은 자리에 `PET_ID_POSITIVE` 를 두었다. `PET_IDS_SIZE_INVALID` 에
`PLAN_115` 를 쓰면서 프레임워크 공통 2종은 §8-2 규칙대로 대역 끝으로 밀렸다 (`PARAMETER_TYPE_INVALID` 115→116, `PARAMETER_REQUIRED` 116→117).
프론트 코드에서 이 두 코드로 분기하는 곳은 없다 (grep 실측).

## 작업 상세 내용 📝

- [x] `PlanCreateRequest.petIds` (`@Size(max = 5)`) — `AiPlanCreateRequest` 와 같은 우선순위 (petIds 승 → petId → 대표견, 없으면 `PLAN_010`)
- [x] `plan_pet` 조인 테이블 + `plan.pet_id` 대표 유지, 옛 행은 읽기 규칙으로 흡수 (이관 SQL 선택)
- [x] `PlanWeatherProcessor` 아이별 판정 → `basisPetId` · `petSuitabilities[]` 응답
- [x] `PlanSummaryInfo` · 상세 · 내부 outline 에 `petIds`
- [x] `GET /plans?petId=` — 한 마리라도 포함되면 히트 (JPQL + H2 슬라이스 테스트)
- [ ] FE: 담기 패널의 판정 기준 선택을 뗄 수 있다 — `draftToPlanPayload` 가 `petIds: snapshot.pets[].petId` 를 보내면 된다. #128 후속으로 남긴다
- [ ] ai-service: `PlanOutlineResponse.petIds` 를 준비물 생성이 읽도록 (`AiPackingProcessor` 는 아직 `petId` 만 본다) — 별도 이슈

## 범위 주의

코드 40파일 + 문서로 30파일을 넘는다. "계약·저장 구조" 와 "날씨 판정" 으로 쪼개는 것을 검토했지만, 두 축이
`PetConditionQueryPort`(대표견 조회 + 벌크 특성 조회) 한 포트를 함께 바꾸고, 저장 구조 없이는 판정에 넘길 `petIds` 가 없어
중간 상태가 develop 에 쌓인다. 같은 이유로 커밋도 코드(한 덩어리로만 컴파일된다)와 문서 둘로 나눴다.
