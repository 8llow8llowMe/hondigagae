import { z } from 'zod'

import { messages } from '@/lib/messages'
import { planBudgetIssue } from '@/lib/plan/budget'
import { planPeriodIssue } from '@/lib/plan/period'

/**
 * 만들기 폼 스키마. **백엔드 제약의 복제본이다** (form-guide.md §5).
 * 필드명은 `PlanCreateRequest` 와 같게 둔다 — 다르면 서버 오류 매핑이 조용히 깨진다.
 *
 * 검증 대상은 **폼 값**(`PlanFormValues`)이고 요청 본문이 아니다 — `budget` 이 폼에서는
 * `''`(빈 값)이고 전송 직전에 생략된다.
 */

/**
 * `YYYY-MM-DD`. **`DateField` 가 이 서식으로만 값을 준다**(`readOnly` 라 타이핑이 없다).
 *
 * 그래도 확인하는 이유는 값이 필드 밖에서도 들어오기 때문이다 — 복원된 스냅샷·주소창.
 * 서식이 어긋난 값을 그대로 보내면 서버가 400 으로 되돌려 준다.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const planFormSchema = z
  .object({
    // PLAN_101 — 라디오가 값을 고정하므로 실질적으로는 2차 방어다
    petId: z.string().min(1, messages.plan.errorPetRequired),
    // PLAN_103 (필수) / PLAN_104 (길이)
    title: z
      .string()
      .trim()
      .min(1, messages.plan.errorTitleRequired)
      .max(60, messages.plan.errorTitleTooLong),
    // PLAN_105
    startDate: z.string().regex(DATE_PATTERN, messages.plan.errorStartDateRequired),
    // PLAN_106
    endDate: z.string().regex(DATE_PATTERN, messages.plan.errorEndDateRequired),
    /**
     * PLAN_107. 선택 입력이라 빈 값을 허용한다 — 여기서 막으면 선택 입력이 사실상
     * 필수가 된다. 소수점·음수·문자를 함께 거른다 (`Number('')` 은 0 이라 조건 순서가 중요).
     *
     * **상한도 여기서 본다.** 서버 `budget` 이 `Integer` 라 넘기면 Bean Validation 이 아니라
     * Jackson 역직렬화에서 깨지고, 그 응답은 필드를 못 짚어 개발자용 문구가 폼 상단 배너로
     * 뜬다 (#566). 판정은 `lib/plan/budget.ts` 한 곳이 갖고 수정 폼과 함께 쓴다.
     *
     * 서식 검사를 먼저 건다 — `abc` 에 "너무 커요" 라고 말하면 안 된다.
     */
    budget: z
      .string()
      .refine((value) => planBudgetIssue(value) !== 'invalid', {
        message: messages.plan.errorBudgetNegative,
      })
      .refine((value) => planBudgetIssue(value) !== 'too-large', {
        message: messages.plan.errorBudgetTooLarge,
      }),
  })
  /**
   * PLAN_003 을 화면이 먼저 본다. 서버도 400 으로 막지만 **왕복 없이 그 자리에서
   * 말해 주는 편이 낫다.** 오류는 종료일에 붙인다 — 사용자가 방금 고른 쪽이다.
   *
   * **판정은 `planPeriodIssue` 가 갖는다** (#585). 수정 폼도 기간을 편집하게 되면서 같은
   * 판정을 둘 곳이 두 곳이 됐다 — 문자열 비교를 여기 남겨 두면 한쪽만 고치는 날이 온다.
   */
  .refine((values) => planPeriodIssue(values.startDate, values.endDate) !== 'reversed', {
    message: messages.plan.errorDateRange,
    path: ['endDate'],
  })
  /**
   * PLAN_009. **예전에는 어느 폼도 보지 않았다** — 31일짜리를 고르면 서버가 왕복 뒤에
   * 돌려줬다. 상한을 아는 판정이 생겼으므로 만들기도 같이 막는다 (#585).
   */
  .refine((values) => planPeriodIssue(values.startDate, values.endDate) !== 'too-long', {
    message: messages.plan.errorPeriodTooLong,
    path: ['endDate'],
  })
