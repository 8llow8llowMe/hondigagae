'use client'

import { ErrorState } from '@/components/error-state'
import { FormAlert } from '@/components/form-alert'
import { formFailureDisplay } from '@/lib/form/form-failure-display'
import type { FailureAnnounce } from '@/lib/form/submit-failure-focus'
import { messages } from '@/lib/messages'

export type FormFailureProps = {
  /** 폼 전체 오류 문구 (`errors.form`). 5xx 에서는 그리지 않는다 */
  message: string | null
  /** 실패한 요청의 HTTP 상태. 성공했거나 아직 요청을 보내지 않았으면 null */
  errorStatus: number | null
  /**
   * 새 요청이 날아가는 중인가 — 그 동안에는 **직전 실패를 걷는다** (#1084 L2).
   *
   * 예전에는 401 알림("이메일 또는 비밀번호가 …")이 다시 낸 요청이 도는 동안에도 그대로 서
   * 있어, 버튼은 "로그인 중" 인데 화면은 "실패했다" 를 함께 말했다. 직전 실패는 새 시도가
   * 시작된 순간 낡은 정보다 — 결과가 다시 실패면 그때 다시 선다. 일시 장애(5xx)도 같다:
   * 재시도를 누른 뒤에도 "잠시 문제가 생겼어요" 가 남으면 눌렸는지 알 수 없다.
   *
   * **필수다.** 선택으로 두면 새 호출부가 빠뜨려도 타입체커가 말하지 않는다.
   */
  submitting: boolean
  /**
   * 무엇으로 읽히는가 — 제출 실패 뒤 **포커스가 이 자리로 오면 `focus`**, 다른 칸으로 가면
   * `live`(`role="alert"`) 다 (#1102). 둘 다 두면 같은 문구를 두 번 읽는다.
   *
   * 호출부가 포커스 effect 와 **같은 판정**(`submitFailureAnnounce(errors, errorStatus)`)으로
   * 넘긴다. 그 effect 가 포커스를 다른 데로 보내는 갈래(로그인 401 · 단계 되돌림 안내)는
   * 호출부가 `live` 로 덮는다.
   *
   * **필수다** — `submitting` 과 같은 이유다. 기본값을 두면 새 호출부가 포커스 배선과 어긋난
   * 값을 조용히 받는다(`focus` 인데 포커스를 안 옮기면 아무것도 읽히지 않는다).
   */
  announce: FailureAnnounce
  onRetry: () => void
  /**
   * 일시 장애 제목의 heading 레벨 — **제목을 가진 `Surface` 안이면 `3`** 이다 (#1101 · #456①).
   *
   * 인증 폼은 화면 `h1` 바로 아래라 기본값 `2` 다. 반려견 폼은 등록 · 수정 둘 다
   * `<Surface lead title=...>` 의 `h2` 안이라 `3` 을 준다 — 카드 내용의 제목이 카드 자신의
   * 제목과 형제가 되면 안 된다. 값과 이유의 정본은 `ErrorState.headingLevel` 이다.
   */
  headingLevel?: 2 | 3
}

/**
 * 폼의 **폼 전체 실패 자리** — 일시 장애이거나 알림이거나, 둘 중 하나만 선다 (#1079).
 *
 * 예전에는 로그인 · 가입 세 단계 · 재설정 두 단계 여섯 자리가 같은 두 줄(`ErrorState` 를 위에
 * 얹고 그 아래 `FormAlert`)을 따로 들고 있었고, 5xx 에서 둘이 함께 섰다. 반려견 등록 · 수정
 * 폼(`pet-form.tsx`)도 같은 이중 표시였다(#1101). 무엇이 서는지는
 * `formFailureDisplay` 하나가 정한다 — 제출 실패 뒤 포커스(`focusSubmitFailure`)도 같은 함수다.
 *
 * **일시 장애는 폼을 대체하지 않는다.** 입력은 그대로 남아 오타를 고칠 수 있다(로그인 D4) —
 * 값을 고치면 호출부가 `errorStatus` 를 비워 이 자리가 걷힌다. **서버 문구(`errors.form`)도
 * `formErrorsAfterEdit` 로 함께 걷는다** — 상태만 비우면 그 문구로 알림이 서서 일시 장애가 서버
 * 문구 알림으로 모양을 바꿨다 (#1102).
 *
 * **일시 장애의 바깥 상자가 `FormAlert` 의 두 몫을 넘겨받는다.**
 * - 낭독 — 숨긴 `FormAlert` 가 하던 일이다. 제출 뒤 화면 변화를 스크린리더가 안다. **`announce`
 *   가 `live` 일 때만 `role="alert"`** 다 — 포커스가 오는 자리(`focus`)면 포커스가 읽는다 (#1102)
 * - `tabIndex={-1}` + `data-form-temporary-error` — 제출 실패 뒤 포커스 대상이다. 재시도 버튼이
 *   아니라 상자인 이유는 `submit-failure-focus.ts` 에 있다(오프라인이면 버튼이 걷힌다)
 *
 * `ErrorState` 는 `flush` 다 — 폼을 담은 카드(인증 셸 · 반려견 `Surface`)가 이미 여백을 갖고
 * 있어, 기본값(세로 48 + 좌우 인셋)을 두면 폼이 그만큼 밀린다. 제목 레벨은 `headingLevel`.
 *
 * **`src/components/` 에 둔다** (#1101) — 인증 · 반려견 두 feature 가 쓴다 (component-guide.md §9,
 * architecture-guide.md §3 "feature 간 직접 임포트를 피한다"). #1079 에서는 쓰는 곳이 인증
 * 하나라 `features/auth/` 에 있었다. 도메인 용어가 prop 에 없어 이름은 그대로다.
 */
export function FormFailure({
  message,
  errorStatus,
  submitting,
  announce,
  onRetry,
  headingLevel = 2,
}: FormFailureProps) {
  if (submitting) return null

  const display = formFailureDisplay(message, errorStatus)

  if (display.kind === 'temporary') {
    return (
      /*
        포커스 테두리를 지우지 않는다 — `FormAlert` 와 같다. 키보드로 온 사람이 "지금 여기" 를
        알아야 한다. **색은 토큰 링이다** (#1084) — 값과 이유는 `FormAlert` 와 같다(그쪽 주석).
      */
      <div
        role={announce === 'live' ? 'alert' : undefined}
        tabIndex={-1}
        data-form-temporary-error=""
        className="focus-visible:ring-brand-500 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ErrorState
          title={messages.common.temporaryErrorTitle}
          description={messages.common.temporaryErrorDescription}
          onRetry={onRetry}
          headingLevel={headingLevel}
          flush
        />
      </div>
    )
  }

  return (
    <FormAlert message={display.kind === 'alert' ? display.message : null} announce={announce} />
  )
}
