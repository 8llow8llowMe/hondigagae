import type { ReactNode } from 'react'

import { ProfileAvatar } from '@/features/member/profile-avatar'
import type { MemberMyInfo } from '@/types/member'

/**
 * 아바타 · 이름 · 이메일 — 아트보드 01 첫 블록.
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
    <div className="flex items-center gap-3 px-4 py-5 md:px-10">
      <ProfileAvatar url={member.profileImageUrl} />

      <span className="min-w-0 flex-1">
        <span className="text-title-2 text-fg block font-bold">{member.name}</span>
        <span className="text-body-2 text-fg-muted block truncate">{member.email}</span>
      </span>

      {trailing}
    </div>
  )
}
