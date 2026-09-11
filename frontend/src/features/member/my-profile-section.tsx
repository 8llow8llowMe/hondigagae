import type { ReactNode } from 'react'

import { ProfileAvatar } from '@/features/member/profile-avatar'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { MemberMyInfo } from '@/types/member'

/**
 * 아바타 · 이름 · 이메일 — 아트보드 01 첫 블록.
 *
 * **L1 카드 안의 첫 블록이다** (`DESIGN.md §0`, 이슈 #466). 혼자서는 카드가 되지 못한다
 * — 자기 제목이 없고 담는 항목도 하나라 카드 판정 ①③ 에 걸린다. 홈이 프로필·판정·
 * 골든타임을 카드 하나에 담은 것과 같은 처리다(#428): 여기서는 `[나 · 내 반려견 ·
 * 내가 저장한 곳]` 이 한 카드가 된다.
 *
 * 이메일은 길면 잘린다. **줄바꿈이 아니라 말줄임**인 이유는 이 줄이 보조 정보라
 * 두 줄이 되면 이름과의 위계가 무너져서다.
 *
 * `trailing` 으로 수정 진입을 받는다. **이 컴포넌트가 모달을 알지 않는다** — 표시와
 * 상태를 갈라 두면 렌더 테스트가 모달 배선 없이 이 블록만 확인할 수 있다.
 */
export function MyProfileSection({
  member,
  trailing,
}: {
  member: Pick<MemberMyInfo, 'name' | 'email' | 'profileImageUrl'>
  trailing?: ReactNode
}) {
  return (
    // 카드 안이라 인셋이 16/20 이다 — 페이지 인셋 40 을 쓰면 내용이 두 번 밀린다 (§0)
    <div className={cn('flex items-center gap-3 pt-2 pb-5', INSET_CLASS.card)}>
      <ProfileAvatar url={member.profileImageUrl} />

      <span className="min-w-0 flex-1">
        <span className="text-title-2 text-fg block font-bold">{member.name}</span>
        <span className="text-body-2 text-fg-muted block truncate">{member.email}</span>
      </span>

      {trailing}
    </div>
  )
}
