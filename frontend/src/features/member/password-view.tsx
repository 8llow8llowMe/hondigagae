'use client'

import { ErrorState } from '@/components/error-state'
import { FormNotice } from '@/components/form-notice'
import { Skeleton } from '@/components/skeleton'
import { PasswordForm } from '@/features/member/password-form'
import { RemovePasswordSection } from '@/features/member/remove-password-section'
import { useMyInfo } from '@/features/member/use-my-info'
import { canRemovePassword, canSetupPassword, toAccountState } from '@/lib/member/account-state'
import { providerName } from '@/lib/member/provider'
import { messages } from '@/lib/messages'

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
 */
export function PasswordView() {
  const query = useMyInfo()

  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  // 404 가 나올 수 없는 리소스다. 남는 것은 일시 장애뿐이라 재시도를 준다
  if (query.isError || query.data === undefined) {
    return (
      <ErrorState
        title={messages.member.loadFailedTitle}
        description={messages.member.loadFailedDescription}
        onRetry={() => void query.refetch()}
      />
    )
  }

  const member = query.data
  const state = toAccountState(member)

  /*
    판별 불가 — 로그인 수단이 하나도 없다는 뜻이라 어느 동작을 제시해도 틀린다.
    **빈 화면을 만들지 않고 안내만 낸다.** 동작 버튼은 하나도 그리지 않는다 (D5).
  */
  if (state === 'unknown') {
    return <FormNotice message={messages.member.accountStateUnknown} />
  }

  const label = providerName(member.provider)

  return (
    <div className="flex flex-col gap-6">
      {label !== null && (
        <p className="text-body-2 text-fg-muted">{messages.member.linkedWith(label)}</p>
      )}

      <PasswordForm mode={canSetupPassword(state) ? 'setup' : 'change'} />

      {/* 전환은 소셜이 연결된 계정만 가능하다. `label` 은 그때 반드시 있다 */}
      {canRemovePassword(state) && label !== null && (
        <RemovePasswordSection providerLabel={label} />
      )}
    </div>
  )
}
