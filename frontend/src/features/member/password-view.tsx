'use client'

import { ErrorState } from '@/components/error-state'
import { FormNotice } from '@/components/form-notice'
import { Skeleton } from '@/components/skeleton'
import { Surface } from '@/components/surface'
import { PasswordForm } from '@/features/member/password-form'
import { RemovePasswordSection } from '@/features/member/remove-password-section'
import { useMyInfo } from '@/features/member/use-my-info'
import { canRemovePassword, canSetupPassword, toAccountState } from '@/lib/member/account-state'
import { providerName } from '@/lib/member/provider'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * `/mypage/password` — **계정 상태 3종을 한 화면이 분기로 처리한다** (공통명세 S2).
 *
 * | `provider` | `hasPassword` | 상태      | 화면                        |
 * | ---------- | ------------- | --------- | --------------------------- |
 * | `null`     | `true`        | 일반      | 변경 폼                     |
 * | `KAKAO` 등 | `false`       | 소셜 전용 | 최초 설정 폼                |
 * | `KAKAO` 등 | `true`        | 연결됨    | 변경 폼 + 소셜 전용 전환    |
 * | `null`     | `false`       | **판별 불가** | 안내만 — 동작 버튼 0개  |
 *
 * 화면을 셋으로 쪼개지 않는 이유는 같은 폼이 세 벌이 되기 때문이다. 쪼개면 새 비밀번호
 * 검증 규칙이 세 곳에 복제된다.
 *
 * ### 3층 표면 (`DESIGN.md §0`, 이슈 #466)
 *
 * **카드를 여기서 그린다.** 머리 값이 응답에서 온다 — 같은 자리가 계정 상태에 따라
 * `비밀번호 변경` / `비밀번호 설정` 으로 갈리므로 `styling-guide.md §3-1` 의 기준
 * ("머리 값이 응답에서 오면 섹션이, 정적이면 페이지가")에 그대로 걸린다.
 *
 * **`소셜 전용으로 전환` 은 카드가 아니다.** 액션은 카드 판정에서 빠지고(§0), 담는 항목도
 * 하나라 ③ 에 걸린다 — 반려견 삭제(#464)와 같은 자리로 L0 바닥 위에 선다. 2a 때 그
 * 블록이 스스로 긋던 `border-t` 가 하던 일을 이제 카드 경계가 맡는다.
 *
 * **네 상태가 카드 머리를 공유한다** (#451). 로딩·오류·판별 불가에서도 카드는 서 있고
 * 몸통만 갈린다 — 다만 그때는 어느 폼인지 단정할 수 없어 **제목 대신 `aria-label`** 을
 * 쓴다 (제목과 접근성 이름이 둘이 되지 않게, `Surface` 주석).
 */
export function PasswordView() {
  const query = useMyInfo()

  if (query.isPending) {
    return (
      <Surface aria-label={messages.member.passwordTitle} aria-busy>
        <div aria-hidden className={cn('flex flex-col gap-4 py-5', INSET_CLASS.card)}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Surface>
    )
  }

  // 404 가 나올 수 없는 리소스다. 남는 것은 일시 장애뿐이라 재시도를 준다
  if (query.isError || query.data === undefined) {
    return (
      <Surface aria-label={messages.member.passwordTitle}>
        <ErrorState
          inset="card"
          title={messages.member.loadFailedTitle}
          description={messages.member.loadFailedDescription}
          onRetry={() => void query.refetch()}
        />
      </Surface>
    )
  }

  const member = query.data
  const state = toAccountState(member)

  /*
    판별 불가 — 로그인 수단이 하나도 없다는 뜻이라 어느 동작을 제시해도 틀린다.
    **빈 화면을 만들지 않고 안내만 낸다.** 동작 버튼은 하나도 그리지 않는다 (D5).
  */
  if (state === 'unknown') {
    return (
      <Surface aria-label={messages.member.passwordTitle}>
        <div className={cn('py-5', INSET_CLASS.card)}>
          <FormNotice message={messages.member.accountStateUnknown} />
        </div>
      </Surface>
    )
  }

  const label = providerName(member.provider)
  const setup = canSetupPassword(state)

  return (
    <>
      <Surface
        lead
        titleId="password-heading"
        title={setup ? messages.member.passwordSetup : messages.member.passwordChange}
        /*
          연결된 소셜은 **부제로 들어간다.** 2a 때는 폼 위에 떠 있는 한 줄이었는데,
          그것이 설명하는 대상이 폼이라 카드 머리가 제자리다 — 반려견 사진 카드(#464)가
          "저장 버튼과 상관없이 바로 반영돼요" 를 부제로 둔 것과 같다.
        */
        description={
          label === null ? undefined : (
            <p className="text-body-2 text-fg-muted">{messages.member.linkedWith(label)}</p>
          )
        }
      >
        {/* 폼은 카드 안이라 인셋이 16/20 이다 — 페이지 인셋 40 을 쓰면 두 번 밀린다 (§0) */}
        <div className={cn('pt-2 pb-5', INSET_CLASS.card)}>
          <PasswordForm mode={setup ? 'setup' : 'change'} />
        </div>
      </Surface>

      {/* 전환은 소셜이 연결된 계정만 가능하다. `label` 은 그때 반드시 있다 */}
      {canRemovePassword(state) && label !== null && (
        <RemovePasswordSection providerLabel={label} />
      )}
    </>
  )
}
