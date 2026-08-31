import { MyPageIcon } from '@/components/icons'
import type { MemberMyInfo } from '@/types/member'

/**
 * 아바타 · 이름 · 이메일 — 아트보드 01 첫 블록.
 *
 * 아바타 64 원형. **원형은 사진·아바타에만 허용된 곡선이다** (DESIGN.md §5).
 * 사진이 없는 것은 오류가 아니라 정상 상태라 빈 원형을 남기지 않고 사람 아이콘을 둔다
 * — `PetAvatar` 가 이니셜을 두는 것과 같은 규칙이고, 회원은 이니셜 대신 아이콘이다
 * (닉네임 첫 글자를 쓰면 반려견 아바타와 같은 모양이 되어 둘이 헷갈린다).
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
  trailing?: React.ReactNode
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

/**
 * 프로필 사진 자리.
 *
 * **`next/image` 를 쓰지 않는다.** 업로드 이미지의 호스트는 배포 환경마다 달라지고
 * (`minio.hondigagae.com` 등) `remotePatterns` 에 미리 등록할 수 없다. 등록되지 않은
 * 호스트를 받으면 `next/image` 는 런타임에 던진다 — 장소 목록·상세에서 겪은 것과 같은
 * 함정이다 (`src/lib/image/remote-host.ts`). 아바타는 64px 고정이라 최적화 이득도 작다.
 */
function ProfileAvatar({ url }: { url: string | null }) {
  if (url !== null && url.length > 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 위 주석: 업로드 호스트를 remotePatterns 에 등록할 수 없다
      <img
        src={url}
        alt=""
        width={64}
        height={64}
        className="bg-band size-16 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      className="bg-band text-fg-muted flex size-16 shrink-0 items-center justify-center rounded-full"
    >
      <MyPageIcon size={28} />
    </span>
  )
}
