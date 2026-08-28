import { cn } from '@/lib/utils/cn'

export type FormNoticeProps = {
  /** 없으면 아무것도 렌더하지 않는다 */
  message: string | null
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
export function FormNotice({ message, className }: FormNoticeProps) {
  if (message === null) return null

  return (
    <p role="status" className={cn('text-body-2 text-fg bg-band rounded-md px-3 py-2', className)}>
      {message}
    </p>
  )
}
