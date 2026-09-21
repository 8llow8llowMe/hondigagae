import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'

/**
 * 일자별 항목 **일괄 교체** 저장 실패의 분류.
 *
 * **편집모드(#81)와 담기(#82)가 같은 함수를 쓴다.** 두 화면이 같은
 * `PUT /plans/{planId}/days/{day}/items` 를 부르므로 실패 분류가 두 벌이 되면
 * 한쪽만 고쳐졌을 때 같은 400 에 다른 안내가 나간다.
 */

export type PlanDaySaveError = {
  message: string
  /** `false` 면 `다시 시도` 를 주지 않는다 — 같은 본문이 같은 실패를 받는다 */
  retriable: boolean
}

/**
 * 화면마다 다른 문구. **분류는 공유하고 문구만 호출부가 준다.**
 *
 * 같은 400 에 같은 뜻이어도 **다음에 할 일이 다르다** — 편집모드는 그 자리에서
 * 항목을 뺄 수 있지만, 담기 화면에는 뺄 목록이 없어 일정으로 돌아가야 한다.
 * 문구까지 공유하면 한쪽에 "할 수 없는 일" 을 지시하게 된다.
 */
export type PlanDaySaveCopy = {
  /** 일시 장애(5xx·무응답) */
  retriable: string
  /** `PLAN_004` — 원천에서 사라진 장소가 그 일자에 담겨 있다 */
  missingPlace: string
}

/**
 * 저장 실패를 문구와 재시도 가능 여부로 옮긴다.
 *
 * **재시도를 주는 것은 일시 장애뿐이다.** `ApiError.kind === 'temporary'`(5xx · 무응답 ·
 * tour-service 연동 실패 `PLAN_900` 503)만 다시 눌러서 풀린다.
 *
 * **4xx 는 전부 재시도를 주지 않는다.** 같은 본문을 다시 보내면 같은 실패다 —
 * `PLAN_004`(사라진 장소) · `PLAN_002`(기간 밖 일자) · `PLAN_001`(404, 지워졌거나 남의 일정) ·
 * `PLAN_100`(시각 형식 오류, #623) · `PLAN_124`(경로변수 형식, #803) ·
 * `PLAN_108`~`PLAN_112`(Bean Validation)가 모두 그렇다.
 * 근거: `PlanErrorCode.java` · `ValidationErrorSupport.java` 소스 실측.
 */
export function toPlanDaySaveError(cause: unknown, copy: PlanDaySaveCopy): PlanDaySaveError {
  if (cause instanceof ApiError) {
    if (cause.resultCode === 'PLAN_004') {
      return { message: copy.missingPlace, retriable: false }
    }
    /*
      `PLAN_100` — `startTime` 본문 파싱 실패 (명세 G4). 문구를 화면마다 나누지 않는다 —
      원인이 "시각 형식" 하나뿐이라 편집모드와 담기가 다르게 말할 이유가 없다.
    */
    if (cause.resultCode === 'PLAN_100') {
      return { message: messages.plan.editStartTimeFormatError, retriable: false }
    }
    /*
      `PLAN_002` 는 문구를 나누지 않는다 — 어느 화면에서든 "들고 있는 상세가 낡았다"
      이고 할 일이 새로고침으로 같다.
    */
    if (cause.resultCode === 'PLAN_002') {
      return { message: messages.plan.editDayOutOfRangeError, retriable: false }
    }

    /*
      나머지 4xx. 코드별 문구를 만들지 않는다 — 사용자가 할 일이 "이 화면을 다시 여는 것"
      으로 같고, 코드마다 문장을 늘리면 서버가 실제로 내지 않는 조합까지 떠안게 된다.
    */
    if (cause.kind !== 'temporary') {
      return { message: messages.plan.saveStaleError, retriable: false }
    }
  }

  return { message: copy.retriable, retriable: true }
}
