'use client'

import { useEffect, useState } from 'react'

import { MyPageIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'

/**
 * 회원 프로필 아바타. 64px 원형 (마이페이지) · 32px 원형 (전역 헤더 계정 메뉴).
 *
 * **원형은 사진·아바타에만 허용된 곡선이다** (DESIGN.md §5). 사진이 없는 것은 오류가
 * 아니라 정상 상태라 빈 원형을 남기지 않고 사람 아이콘을 둔다 — `PetAvatar` 가 이니셜을
 * 두는 것과 같은 규칙이고, 회원은 이니셜 대신 아이콘이다 (닉네임 첫 글자를 쓰면 반려견
 * 아바타와 같은 모양이 되어 둘이 헷갈린다).
 *
 * ### `next/image` 가 아니라 `<img>` 인 이유
 *
 * 업로드 호스트가 `MINIO_PUBLIC_URL` 환경변수라 **환경마다 다르다.** `remote-host.ts` 는
 * 고정 목록이라 여기에 등록하는 방식은 배포 환경이 바뀔 때마다 `next.config.ts` 를
 * 고쳐야 하고, 등록되지 않은 호스트에서는 아바타가 조용히 사라진다. 64px 고정이라
 * 최적화 이득도 작다 (공통명세 S3 이미지 호스트 문단).
 *
 * ### 로드 실패 폴백이 필요한 이유
 *
 * `<img>` 는 URL 이 안 열리면 **깨진 이미지 아이콘**을 그린다. 저장된 URL 은 살아 있는데
 * 호스트가 죽었거나 파일이 지워진 경우가 실제로 생긴다 — 그때 사람 아이콘으로 떨어지는
 * 편이 낫다. 사진 없는 상태와 같은 모습이라 사용자가 이해할 수 있다.
 */
const SIZE = {
  /** 마이페이지 프로필 줄 · 수정 모달 */
  md: { box: 'size-16', px: 64, icon: 28 },
  /** 전역 헤더 계정 메뉴 트리거 (44 버튼 안) */
  sm: { box: 'size-8', px: 32, icon: 20 },
} as const

export function ProfileAvatar({
  url,
  size = 'md',
  className,
}: {
  url: string | null
  size?: keyof typeof SIZE
  className?: string
}) {
  const { box, px, icon } = SIZE[size]
  const [failed, setFailed] = useState(false)

  // URL 이 바뀌면 실패 기록을 지운다. 안 그러면 한 번 깨진 뒤 새 사진을 올려도
  // 계속 폴백만 보인다 — 업로드 성공이 화면에 반영되지 않는다
  useEffect(() => {
    setFailed(false)
  }, [url])

  const shape = cn(box, 'shrink-0 rounded-full', className)

  if (url === null || url.length === 0 || failed) {
    return (
      <span
        aria-hidden
        className={cn('bg-band text-fg-muted flex items-center justify-center', shape)}
      >
        <MyPageIcon size={icon} />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 위 주석: 업로드 호스트를 remotePatterns 에 등록할 수 없다
    <img
      src={url}
      alt=""
      width={px}
      height={px}
      onError={() => setFailed(true)}
      className={cn('bg-band object-cover', shape)}
    />
  )
}
