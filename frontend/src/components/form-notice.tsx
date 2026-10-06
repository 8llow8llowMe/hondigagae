import type { Ref } from 'react'

import type { FailureAnnounce } from '@/lib/form/submit-failure-focus'
import { cn } from '@/lib/utils/cn'

export type FormNoticeProps = {
  /** 없으면 아무것도 렌더하지 않는다 */
  message: string | null
  /**
   * 무엇으로 읽히는가 — `FormAlert.announce` 와 같은 계약이다 (form-guide.md §8, #1102).
   *
   * **기본값 `live`(`role="status"`)** 는 지금까지의 동작 그대로다. `focus` 는 **나타난 뒤
   * 포커스가 이 안내로 옮겨 오는 자리** 전용이다 — 역할을 떼고 포커스 하나로 읽힌다. 지금은
   * 일정 상태 전이의 결과(`plan-status-action-panel.tsx`, #1174 — 판정은
   * `planStatusResultAnnounce`)만 넘긴다.
   *
   * 타입 이름이 `Failure` 지만 값(`live` · `focus`)은 낭독 경로일 뿐이다 — 성공용 별칭을 따로 두면
   * 같은 두 값이 두 이름으로 갈린다.
   */
  announce?: FailureAnnounce | undefined
  /** `announce="focus"` 일 때 포커스를 옮길 손잡이 */
  ref?: Ref<HTMLParagraphElement>
  className?: string
}

/**
 * 폼의 성공/정보 안내. `FormAlert` 와 같은 계약 — `message` 가 `null` 이면 렌더하지 않는다.
 *
 * **`role="status"` 가 핵심이다.** 오류가 아니라 진행 안내(예: "메일로 인증코드를
 * 보냈어요.")라 `role="alert"` 가 아니라 `role="status"` 를 쓴다.
 *
 * `signup-steps.tsx`(2곳)·`signup-done-notice.tsx`(1곳)에 같은 마크업이 복제돼 있던 것을
 * `done-checklist.md` 2-2("2곳 이상에서 쓰이면 승격")에 따라 승격했다 — 이슈 #24 최종 리뷰 I4.
 */
export function FormNotice({ message, announce = 'live', ref, className }: FormNoticeProps) {
  if (message === null) return null

  const focusable = announce === 'focus'

  return (
    <p
      ref={ref}
      role={focusable ? undefined : 'status'}
      /*
        **포커스를 받을 때만 `tabIndex={-1}` 이다** — 탭 순서에는 끼우지 않고 프로그램으로만
        받는다. 테두리 없는 채움 상자라 링은 `FormAlert` 와 같이 `ring-offset-2` 다
        (DESIGN.md §2-4 포커스 링 표).
      */
      tabIndex={focusable ? -1 : undefined}
      className={cn(
        'text-body-2 text-fg bg-band rounded-md px-3 py-2',
        focusable &&
          'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      {message}
    </p>
  )
}
