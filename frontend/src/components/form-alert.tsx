import type { Ref } from 'react'

import type { FailureAnnounce } from '@/lib/form/submit-failure-focus'
import { cn } from '@/lib/utils/cn'

export type FormAlertProps = {
  /** 없으면 아무것도 렌더하지 않는다 */
  message: string | null
  /**
   * 무엇으로 읽히는가 — **기본값 `live`(`role="alert"`)** 는 지금까지의 동작 그대로다 (#1102).
   *
   * `focus` 는 **나타난 뒤 포커스가 이 알림으로 옮겨 오는 자리** 전용이다 — 역할을 떼고 포커스
   * 하나로 읽힌다. 둘 다 두면 알림 낭독과 포커스 낭독이 같은 문구를 두 번 읽는다. 포커스를 실제로
   * 옮기지 않는 자리에 `focus` 를 주면 **아무것도 읽히지 않는다** — 그래서 값은 손으로 고르지 않고
   * 포커스 effect 와 같은 판정(`submitFailureAnnounce`)에서 받는다. 지금은 `FormFailure` 와 공유 모달
   * (`plan-share-modal.tsx`, 재시도 결과 — 판정은 `shareFailureAnnounce`, #1159), 일정 상태 전이의
   * 실패(`plan-status-action-panel.tsx`, #1203 — 판정은 `planStatusResultAnnounce`)가 넘긴다.
   */
  announce?: FailureAnnounce | undefined
  /**
   * 포커스를 옮길 손잡이 — `FormNotice.ref` 와 같다 (#1203). 폼 밖이라 선택자(`FORM_ALERT_SELECTOR`)로
   * 찾을 컨테이너가 없는 자리가 쓴다.
   */
  ref?: Ref<HTMLParagraphElement>
  className?: string
}

/**
 * 폼 전체 오류.
 *
 * **`role="alert"` 이 핵심이다.** 제출 후 화면 변화가 없으면 스크린리더
 * 사용자가 실패했다는 것을 알 수 없다 — docs/form-guide.md §8.
 *
 * 5xx 는 이것이 아니라 `ErrorState` 를 쓴다. 여기는 입력을 고쳐야 하는 실패다.
 *
 * **포커스를 받는 자리면 `announce="focus"`** — 그때는 포커스가 낭독 경로다 (#1102, 위 prop).
 */
export function FormAlert({ message, announce = 'live', ref, className }: FormAlertProps) {
  if (message === null) return null

  return (
    <p
      ref={ref}
      role={announce === 'live' ? 'alert' : undefined}
      /*
        **제출 실패 뒤 포커스 대상이다** (#1078). 제출 중 버튼이 `disabled` 가 되면 포커스가
        `BODY` 로 떨어지는데, 필드 오류 없이 이것만 서는 실패(5xx · 429 · 409 …)에서는 돌려
        보낼 필드가 없다. 탭 순서에는 끼우지 않고(-1) 프로그램으로만 받는다. 찾는 쪽은
        `role` 이 아니라 이 속성을 본다 (`lib/form/submit-failure-focus.ts`).

        포커스 테두리를 지우지 않는다 — 키보드로 온 사람이 "지금 여기" 를 알아야 한다.

        **색은 토큰 링으로 바꾼다** (#1084). 예전에는 아무것도 주지 않아 브라우저 기본
        테두리(`rgb(0,95,204)` 파랑)가 그려졌다 — 화면의 다른 포커스는 전부 `--brand-500`
        초록이라 여기만 다른 제품처럼 보였다. 테두리 없이 채움만 있는 상자라 `ring-offset-2`
        다 (DESIGN.md §2-4 포커스 링 표): 링이 `--danger-100` 채움에 붙으면 묻힌다.
      */
      tabIndex={-1}
      data-form-alert=""
      // tint 배경 위 텍스트는 -700 이다. -500 은 danger-100 위에서 3.97:1 로 AA 에
      // 미달한다 (DESIGN.md §2-6). -500 은 흰 배경 위 아이콘·보더용이다.
      // 회귀는 src/styles/token-usage.test.ts 가 막는다.
      className={cn(
        'text-body-2 text-danger-700 bg-danger-100 rounded-md px-3 py-2 break-words',
        'focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      {message}
    </p>
  )
}
