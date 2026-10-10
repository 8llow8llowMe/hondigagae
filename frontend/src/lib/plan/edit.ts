import { messages } from '@/lib/messages'
import { planBudgetIssue } from '@/lib/plan/budget'
import { companionPetsOf } from '@/lib/plan/companion-pets'
import { planPeriodIssue } from '@/lib/plan/period'
import type { Pet } from '@/types/pet'
import type { PlanUpdatePayload } from '@/types/plan'

/**
 * 이름 · 기간 · 예산 · 동행 반려견 수정 폼의 값 변환과 검증. **변환은 이 한 곳에서만 한다**
 * (form-guide.md §5, `toPlanCreatePayload` 와 같은 규칙).
 */

export type PlanEditValues = {
  title: string
  /** `YYYY-MM-DD`. `DateField` 가 이 서식으로만 값을 준다 */
  startDate: string
  /** `YYYY-MM-DD` */
  endDate: string
  /** 폼에서는 문자열이다. 빈 값이 허용된다 */
  budget: string
  /**
   * 체크 순서. **첫 번째가 대표**다 (`plan.pet_id` — `PlanCommandProcessor.java:225`).
   *
   * **문자열이다.** 요청 스키마는 `int64` 지만 Snowflake 라 `Number()` 를 거치면 정밀도를
   * 잃는다 — 응답이 준 문자열을 그대로 싣는다 (`lib/ai-plan/submit.ts` 와 같은 규칙).
   */
  petIds: string[]
}

/**
 * 폼 밖에서 오는 사실 — 값이 아니라 **맥락**이다.
 *
 * 둘 다 필수다. 선택 prop 으로 두면 새 호출부가 빠뜨렸을 때 완료 일정에도 `petIds` 가
 * 실려 나가는데, 그 실수는 타입 오류 없이 **저장 전체를 `PLAN_019` 로 죽인다.**
 */
export type PlanEditContext = {
  /**
   * 동행견 그룹이 폼에 있는가. 완료(`COMPLETED`) 일정과 고를 반려견이 없을 때 `false` 다
   * (명세 D13-2 · D13-3).
   */
  petsEditable: boolean
  /** 모달을 열 때의 선택. **순서까지** 같으면 키를 싣지 않는다 (명세 D13-4) */
  initialPetIds: readonly string[]
}

/**
 * 폼의 초기 선택 — `plan.petIds` 중 **옵션에 있는 것만**, `plan.petIds` 순서 그대로.
 *
 * **`companionPetsOf` 를 그대로 쓴다.** 상세의 반려견 카드가 보여 주는 명단과 이 폼의
 * 초기 체크가 갈리면, 화면에 없던 아이가 저장에 섞이거나 반대로 빠진다.
 *
 * 삭제된 아이의 잔여 id 는 여기서 빠지므로 "변경 없음" 판정에서도 빠진다 — 조용한 정리를
 * 저장에 섞지 않으려는 결정이다 (명세 D13-4 · 미결 2, 정리는 BE 후속 D13-11).
 */
export function planEditPetIds(petIds: readonly string[], pets: readonly Pet[]): string[] {
  return companionPetsOf(petIds, pets).map((pet) => pet.petId)
}

/** 순서까지 같은가. **첫 번째가 대표라 순서가 값이다** — 순서만 바뀌어도 "바뀜" 이다 */
function samePetIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((petId, index) => petId === b[index])
}

const TITLE_MAX = 60

/** `YYYY-MM-DD`. 만들기 스키마(`features/plan/schemas.ts`)와 같은 이유로 서식을 확인한다 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 필드명 → 메시지. 서버 `PlanValidationMessage` 와 같은 문구를 쓴다 */
export function validatePlanEdit(
  values: PlanEditValues,
  context: PlanEditContext,
): Record<string, string> {
  const errors: Record<string, string> = {}

  const title = values.title.trim()
  if (title.length === 0) errors.title = messages.plan.errorTitleRequired
  else if (title.length > TITLE_MAX) errors.title = messages.plan.errorTitleTooLong

  /*
    **기간은 여기서 연다** (#585). 닫아 뒀던 근거(고아 항목)는 서버가 `PLAN_008` 로
    거부하면서 사라졌다 — `types/plan.ts` 의 `PlanUpdatePayload` 주석 참고.

    서식을 먼저 보고 관계(역전·상한)를 그다음에 본다. 순서를 뒤집으면 빈 값에 "시작일은
    종료일보다 늦을 수 없습니다" 가 붙는다.
  */
  if (!DATE_PATTERN.test(values.startDate)) errors.startDate = messages.plan.errorStartDateRequired
  if (!DATE_PATTERN.test(values.endDate)) errors.endDate = messages.plan.errorEndDateRequired

  /*
    판정은 만들기 폼과 **같은 함수**(`planPeriodIssue`)다. 오류는 종료일에 붙인다 —
    만들기 폼의 `refine(path: ['endDate'])` 과 같은 자리이고, 사용자가 방금 고른 쪽이다.
  */
  switch (planPeriodIssue(values.startDate, values.endDate)) {
    case 'reversed':
      errors.endDate = messages.plan.errorDateRange
      break
    case 'too-long':
      errors.endDate = messages.plan.errorPeriodTooLong
      break
    default:
      break
  }

  /*
    서버는 `@PositiveOrZero` 다. 소수·문자·음수를 여기서 먼저 걸러 왕복을 아낀다.

    **상한도 본다.** 만들기 폼과 같은 판정(`planBudgetIssue`)을 쓴다 — 예전에는 이쪽만
    상한이 없어, 수정 모달로 큰 수를 넣으면 서버가 역직렬화에서 깨지며 개발자용 문구가
    그대로 떴다 (#566).

    같은 함수로 옮기면서 `1e3` · `+5` 처럼 `Number()` 는 통과하지만 서식이 아닌 값도
    함께 막힌다. 만들기 폼은 원래 막고 있었으므로 두 폼이 이제 같은 답을 낸다.
  */
  switch (planBudgetIssue(values.budget)) {
    case 'invalid':
      errors.budget = messages.plan.errorBudgetNegative
      break
    case 'too-large':
      errors.budget = messages.plan.errorBudgetTooLarge
      break
    default:
      break
  }

  /*
    **0마리는 화면이 먼저 막는다** (명세 D13-5). 서버는 빈 배열을 `PLAN_010` 으로
    거절하고 생성과 달리 대표견 폴백이 없다 — 왕복해서 배너로 듣느니 그룹에 붙인다.

    **`petsEditable` 일 때만 본다.** 완료 일정에는 그 필드가 아예 없으므로, 여기서 세면
    고칠 수 없는 필드 때문에 제목 수정이 막힌다.

    **초기 선택이 이미 비어 있었으면 보지 않는다** (#752). 동행견이 전부 삭제된 일정은
    0마리로 열리는데, 다른 반려견이 남아 있으면 `petsEditable` 이 `true` 라 여기에 걸려
    **제목 · 기간 · 예산조차 저장할 수 없었다.** 0마리는 사용자의 조작이 아니라 **시작
    상태**이고, 막으면 그 일정은 영영 못 고친다. 서버도 `petIds` 키가 없으면 소유 검증조차
    부르지 않으므로(`toPlanUpdatePayload` 의 두 번째 갈래) 저장은 그대로 통과한다.

    **초기 선택이 있었는데 전부 해제한 경우는 지금처럼 막는다.** 그건 의도적 조작이고,
    서버가 빈 배열을 `PLAN_010` 으로 거절한다 — 여기서 통과시키면 왕복해서 배너로 듣는다.

    상한(5)은 보지 않는다 — 옵션이 회원의 반려견 전부이고 그 수가 최대 5다. 서버
    `PLAN_115` 가 2차 방어다.
  */
  if (context.petsEditable && values.petIds.length === 0 && context.initialPetIds.length > 0) {
    errors.petIds = messages.plan.errorPetRequired
  }

  return errors
}

/**
 * 동행견 그룹 아래 한 줄 — **상황에 따라 다른 말을 한다** (#752).
 *
 * 기본은 대표를 사실로만 말하는 `editPetsHint` 다 (D13-7). 그런데 동행견이 전부 삭제돼
 * **0마리로 열린 폼**에서는 그 문구만 서 있으면 _"왜 아무것도 안 골라져 있지, 골라야
 * 저장되나"_ 로 읽힌다 — 검증은 더 이상 막지 않는데 화면이 반대로 말하는 셈이다.
 *
 * 그래서 `초기 0마리 + 지금도 0마리` 일 때만 `editPetsClearedHint` 로 갈아 끼운다.
 * 하나라도 고르는 순간 대표가 생기므로 곧바로 기존 힌트로 돌아온다.
 *
 * **모달에서 뽑아 여기 둔다.** `PlanEditModal` 은 `useQueryClient` 를 쓰므로 node 환경에서
 * 렌더되지 않는다 (`testing-guide.md` §1 한계) — 분기를 순수 함수로 내려야 잠글 수 있다.
 */
export function planEditPetsHint(
  values: Pick<PlanEditValues, 'petIds'>,
  context: Pick<PlanEditContext, 'initialPetIds'>,
): string {
  if (context.initialPetIds.length === 0 && values.petIds.length === 0) {
    return messages.plan.editPetsClearedHint
  }

  return messages.plan.editPetsHint
}

/**
 * 폼 값 → `PUT /plans/{planId}` 요청 본문.
 *
 * **예산을 비우면 `0` 을 보낸다.** `budget` 을 생략하거나 `null` 로 보내면 서버가
 * "유지" 로 읽어 예전 값이 그대로 남는다 — 지운 것이 반영되지 않는다.
 * `@PositiveOrZero` 라 0 은 유효하고, 화면도 그렇게 저장된다고 미리 말한다 (D4).
 *
 * **기간은 바뀌지 않았어도 두 날짜를 함께 보낸다** (#585). 부분 수정이라 생략해도
 * 결과는 같지만, 한쪽만 보내는 경로를 만들지 않으려는 것이다 — 시작일만 보내면 서버가
 * 새 시작일과 옛 종료일로 기간을 다시 계산한다 (`PlanUpdatePayload` 주석).
 *
 * **`status` 를 넣지 않는다.** 확정은 별도 동작이고, 여기서 함께 보내면 수정만 하려던
 * 사용자가 상태까지 바꾸게 된다.
 *
 * **`petIds` 는 바뀌었을 때만 넣는다 — 기간과 반대 규칙이다** (명세 D13-4). 기간은 한쪽만
 * 보내면 서버가 옛 값과 섞어 다시 계산하므로 안 바뀌어도 둘 다 보내지만, `petIds` 는
 * 섞일 값이 없고 같은 목록을 다시 보내면 서버가 `plan_pet` 을 **지웠다 다시 넣는다**
 * (`PlanCommandProcessor.java:246-247`). 얻는 것이 없는 쓰기다.
 */
export function toPlanUpdatePayload(
  values: PlanEditValues,
  context: PlanEditContext,
): PlanUpdatePayload {
  const budget = values.budget.trim()

  const payload: PlanUpdatePayload = {
    title: values.title.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
    budget: budget === '' ? 0 : Number(budget),
  }

  /*
    세 갈래로 키를 **만들지 않는다.** 키가 없으면 서버는 "유지" 로 읽고 소유 검증조차
    부르지 않는다 (`PlanWebFacade.java:111-112`).

    (1) 폼에 그룹이 없었다 — 완료 일정이거나 고를 반려견이 없다. 완료 일정에서 키가 새면
        **제목만 고치려던 저장이 `PLAN_019` 로 죽는다.** 컨트롤을 숨기는 것과 별개로
        여기서 한 번 더 잠근다 (명세 D13-3 · D13-4).
    (2) 0마리 — 빈 배열은 400 `PLAN_010` 이다. 생성과 달리 대표견 폴백이 없어
        (`PlanCreateRequest.effectivePetIds()` 와 다른 지점) 저장이 통째로 실패한다.
        **이 갈래가 #752 를 실제로 통과시키는 곳이다** — 동행견이 전부 삭제돼 0마리로
        열린 폼은 검증이 더 이상 막지 않고(`validatePlanEdit`), 여기서 키를 만들지 않아
        서버가 "유지" 로 읽는다. 초기 선택이 있었는데 전부 해제한 경우는 검증이 먼저
        막으므로 여기까지 오지 않지만, 변환도 만들지 않는 것은 그대로다.
    (3) 초기 선택과 같다 — **순서까지** 같을 때만이다. 첫 번째가 대표라 순서가 값이다.
  */
  if (!context.petsEditable) return payload
  if (values.petIds.length === 0) return payload
  if (samePetIds(values.petIds, context.initialPetIds)) return payload

  return { ...payload, petIds: [...values.petIds] }
}
