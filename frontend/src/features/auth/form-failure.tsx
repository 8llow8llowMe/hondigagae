'use client'

import { ErrorState } from '@/components/error-state'
import { FormAlert } from '@/components/form-alert'
import { formFailureDisplay } from '@/lib/form/form-failure-display'
import { messages } from '@/lib/messages'

export type FormFailureProps = {
  /** 폼 전체 오류 문구 (`errors.form`). 5xx 에서는 그리지 않는다 */
  message: string | null
  /** 실패한 요청의 HTTP 상태. 성공했거나 아직 요청을 보내지 않았으면 null */
  errorStatus: number | null
  onRetry: () => void
}

/**
 * 인증 폼의 **폼 전체 실패 자리** — 일시 장애이거나 알림이거나, 둘 중 하나만 선다 (#1079).
 *
 * 예전에는 로그인 · 가입 세 단계 · 재설정 두 단계 여섯 자리가 같은 두 줄(`ErrorState` 를 위에
 * 얹고 그 아래 `FormAlert`)을 따로 들고 있었고, 5xx 에서 둘이 함께 섰다. 무엇이 서는지는
 * `formFailureDisplay` 하나가 정한다 — 제출 실패 뒤 포커스(`focusSubmitFailure`)도 같은 함수다.
 *
 * **일시 장애는 폼을 대체하지 않는다.** 입력은 그대로 남아 오타를 고칠 수 있다(로그인 D4) —
 * 값을 고치면 호출부가 `errorStatus` 를 비워 이 자리가 걷힌다.
 *
 * **일시 장애의 바깥 상자가 `FormAlert` 의 두 몫을 넘겨받는다.**
 * - `role="alert"` — 숨긴 `FormAlert` 가 하던 알림이다. 제출 뒤 화면 변화를 스크린리더가 안다
 * - `tabIndex={-1}` + `data-form-temporary-error` — 제출 실패 뒤 포커스 대상이다. 재시도 버튼이
 *   아니라 상자인 이유는 `submit-failure-focus.ts` 에 있다(오프라인이면 버튼이 걷힌다)
 *
 * `ErrorState` 는 `flush` 다 — 인증 카드가 이미 여백을 갖고 있어, 기본값(세로 48 + 좌우 인셋)을
 * 두면 폼이 그만큼 밀린다. 제목은 `h2` 다: 화면의 `h1`(로그인 · 회원가입 …) 바로 아래다.
 *
 * feature 안에 둔다 — 쓰는 곳이 인증 하나다 (component-guide.md §9). 반려견 폼(`pet-form.tsx`)도
 * 같은 이중 표시를 들고 있지만 #1079 범위 밖이다.
 */
export function FormFailure({ message, errorStatus, onRetry }: FormFailureProps) {
  const display = formFailureDisplay(message, errorStatus)

  if (display.kind === 'temporary') {
    return (
      /*
        포커스 테두리를 지우지 않는다 — `FormAlert` 와 같다. 키보드로 온 사람이 "지금 여기" 를
        알아야 한다.
      */
      <div role="alert" tabIndex={-1} data-form-temporary-error="" className="rounded-md">
        <ErrorState
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
          flush
        />
      </div>
    )
  }

  return <FormAlert message={display.kind === 'alert' ? display.message : null} />
}
