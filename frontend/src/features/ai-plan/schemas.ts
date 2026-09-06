import { z } from 'zod'

import { MAX_PINNED_PLACES } from '@/lib/ai-plan/pinned'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'

/**
 * 조건 입력 폼 스키마. **백엔드 제약의 복제본이다** (form-guide.md §5).
 * 필드명은 `AiPlanCreateRequest` 와 같게 둔다 — 다르면 서버 오류 매핑이 조용히 깨진다.
 *
 * 예외가 하나 있다: **`budgetManwon` 은 계약에 없는 이름**이다. 계약의 `budget` 은 원
 * 단위인데 폼은 만원 단위로 받으므로(아트보드 01) 이름을 같게 두면 단위가 다른 두 값이
 * 같은 이름을 쓰게 된다.
 *
 * 검증 대상은 **폼 값**(`AiPlanFormValues`)이고 요청 본문이 아니다.
 */

/**
 * `YYYY-MM-DD`. **`DateField` 가 이 서식으로만 값을 준다**(`readOnly` 라 타이핑이 없다).
 *
 * 그래도 확인하는 이유는 값이 필드 밖에서도 들어오기 때문이다 — 복원된 스냅샷·주소창.
 * 서식이 어긋난 값을 그대로 보내면 서버가 400 으로 되돌려 준다.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const aiPlanFormSchema = z
  .object({
    /**
     * AIPLAN_107. 선택 입력이라 빈 값을 허용한다 — 여기서 막으면 선택 입력이 사실상
     * 필수가 된다 (아트보드 01 주석: "자유 입력을 필수로 두면 '뭘 써야 하지'에서 막힌다").
     */
    requestNote: z.string().max(500, messages.aiPlan.errorNoteTooLong),
    // AIPLAN_102
    startDate: z.string().regex(DATE_PATTERN, messages.aiPlan.errorStartDateRequired),
    // AIPLAN_103
    endDate: z.string().regex(DATE_PATTERN, messages.aiPlan.errorEndDateRequired),
    /**
     * AIPLAN_115 (`@Size(max = 10)`). **`null` 이 "제주 전체" 다** (#251).
     *
     * 코드 목록으로 좁히지 않는다 — 칩이 값을 고정하므로 실질적인 2차 방어이고,
     * 원천에 폐지된 시군구 코드가 남아 있어 화면이 목록을 늘리게 될 수 있다.
     * 여기서 지켜야 하는 것은 **길이 상한**뿐이다.
     */
    sigunguCode: z.string().min(1).max(10).nullable(),
    /**
     * AIPLAN_105. 체크박스가 값을 고정하므로 실질적으로는 2차 방어다.
     *
     * **서버는 반려견을 선택으로 받는다**(없으면 대표 반려견)지만 화면은 필수로 둔다 —
     * 어느 아이 기준으로 짠 일정인지 사용자가 알아야 결과를 판단할 수 있다.
     *
     * 상한은 백엔드 `@Size(max = 5)` 와 회원당 반려견 상한이 같은 값이라 후자를 쓴다 —
     * 숫자를 새로 적지 않는다 (#128).
     */
    petIds: z
      .array(z.string().min(1))
      .min(1, messages.aiPlan.errorPetRequired)
      .max(MAX_PET_COUNT, messages.aiPlan.errorPetTooMany),
    /**
     * AIPLAN_106. 선택 입력이라 빈 값을 허용한다.
     *
     * **`0` 을 거부한다.** 계약이 `@Positive` 라 `0` 은 400 이고, "상관없음" 은 빈 값으로
     * 표현한다 (`src/lib/ai-plan/submit.ts`). `Number('')` 이 `0` 이라 조건 순서가 중요하다.
     */
    budgetManwon: z.string().refine((value) => {
      const trimmed = value.trim()
      if (trimmed === '') return true
      return /^\d+$/.test(trimmed) && Number(trimmed) > 0
    }, messages.aiPlan.errorBudgetPositive),
    /** 체크박스가 값을 고정한다. 스키마에 두는 것은 폼 값 전체를 한 타입으로 검증하기 위해서다 */
    preferFavorites: z.boolean(),
    /**
     * AIPLAN — `@Size(max = 10)` 복제본. **시트가 이미 상한을 막지만 2차 방어를 둔다.**
     *
     * 빈 배열을 허용한다 — 선택 입력이다.
     */
    pinnedPlaces: z
      .array(z.object({ placeId: z.string().min(1), title: z.string().min(1) }))
      .max(MAX_PINNED_PLACES, messages.aiPlan.errorPinnedTooMany),
  })
  /**
   * AIPLAN_001 을 화면이 먼저 본다. 서버도 400 으로 막지만 **왕복 없이 그 자리에서
   * 말해 주는 편이 낫다.** 오류는 종료일에 붙인다 — 사용자가 방금 고른 쪽이다
   * (`planFormSchema` 와 같은 판단).
   */
  .refine(
    (values) =>
      values.startDate === '' || values.endDate === '' || values.startDate <= values.endDate,
    { message: messages.aiPlan.errorDateRange, path: ['endDate'] },
  )

/** 담기 직전 제목 폼 — `POST /plans` 의 `title` 제약 복제본 */
export const aiPlanCommitSchema = z.object({
  // PLAN_103 / PLAN_104
  title: z
    .string()
    .trim()
    .min(1, messages.aiPlan.errorTitleRequired)
    .max(60, messages.aiPlan.errorTitleTooLong),
})
