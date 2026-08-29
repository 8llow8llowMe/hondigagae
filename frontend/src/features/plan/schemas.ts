import { z } from 'zod'

import { messages } from '@/lib/messages'

/**
 * 만들기 폼 스키마. **백엔드 제약의 복제본이다** (form-guide.md §5).
 * 필드명은 `PlanCreateRequest` 와 같게 둔다 — 다르면 서버 오류 매핑이 조용히 깨진다.
 *
 * 검증 대상은 **폼 값**(`PlanFormValues`)이고 요청 본문이 아니다 — `budget` 이 폼에서는
 * `''`(빈 값)이고 전송 직전에 생략된다.
 */

/** `<input type="date">` 가 주는 서식. 사용자가 직접 칠 수도 있어 형식을 다시 본다 */
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
     */
    budget: z.string().refine((value) => value.trim() === '' || /^\d+$/.test(value.trim()), {
      message: messages.plan.errorBudgetNegative,
    }),
  })
  /**
   * PLAN_003 을 화면이 먼저 본다. 서버도 400 으로 막지만 **왕복 없이 그 자리에서
   * 말해 주는 편이 낫다.** 오류는 종료일에 붙인다 — 사용자가 방금 고른 쪽이다.
   */
  .refine(
    (values) =>
      values.startDate === '' || values.endDate === '' || values.startDate <= values.endDate,
    {
      message: messages.plan.errorDateRange,
      path: ['endDate'],
    },
  )
