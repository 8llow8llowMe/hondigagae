import { cn } from '@/lib/utils/cn'

export type FormAlertProps = {
  /** 없으면 아무것도 렌더하지 않는다 */
  message: string | null
  className?: string
}

/**
 * 폼 전체 오류.
 *
 * **`role="alert"` 이 핵심이다.** 제출 후 화면 변화가 없으면 스크린리더
 * 사용자가 실패했다는 것을 알 수 없다 — docs/form-guide.md §8.
 *
 * 5xx 는 이것이 아니라 `ErrorState` 를 쓴다. 여기는 입력을 고쳐야 하는 실패다.
 */
export function FormAlert({ message, className }: FormAlertProps) {
  if (message === null) return null

  return (
    <p
      role="alert"
      /*
        **제출 실패 뒤 포커스 대상이다** (#1078). 제출 중 버튼이 `disabled` 가 되면 포커스가
        `BODY` 로 떨어지는데, 필드 오류 없이 이것만 서는 실패(5xx · 429 · 409 …)에서는 돌려
        보낼 필드가 없다. 탭 순서에는 끼우지 않고(-1) 프로그램으로만 받는다. 찾는 쪽은
        `role` 이 아니라 이 속성을 본다 (`lib/form/submit-failure-focus.ts`).

        포커스 테두리를 지우지 않는다 — 키보드로 온 사람이 "지금 여기" 를 알아야 한다.
      */
      tabIndex={-1}
      data-form-alert=""
      // tint 배경 위 텍스트는 -700 이다. -500 은 danger-100 위에서 3.97:1 로 AA 에
      // 미달한다 (DESIGN.md §2-6). -500 은 흰 배경 위 아이콘·보더용이다.
      // 회귀는 src/styles/token-usage.test.ts 가 막는다.
      className={cn(
        'text-body-2 text-danger-700 bg-danger-100 rounded-md px-3 py-2 break-words',
        className,
      )}
    >
      {message}
    </p>
  )
}
