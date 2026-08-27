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
      // bg-danger-50 는 존재하지 않는 토큰이다 (tokens.css 는 danger-100/500/700 만
      // 정의한다). DESIGN.md 가 정본이므로 새 토큰을 만들지 않고 danger-100 을 쓴다.
      className={cn(
        'text-body-2 text-danger-500 bg-danger-100 rounded-md px-3 py-2 break-words',
        className,
      )}
    >
      {message}
    </p>
  )
}
