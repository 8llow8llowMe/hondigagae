'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils/cn'

export type PetAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

/**
 * 반려견 아바타 원형 — 사진이 있으면 사진, 없으면 이니셜.
 *
 * **원형은 사진·아바타에만 허용된 곡선이다** (DESIGN.md §5). 폴백 순서는
 * 업로드 → 견종 일러스트 → 이니셜인데 견종 일러스트는 자료가 없어 건너뛴다.
 * **빈 원형을 남기지 않는다.**
 *
 * **사진을 받는다.** 예전에는 "백엔드에 사진 필드가 없다" 는 전제로 이니셜만 그렸는데,
 * `Pet.profileImageUrl` 이 생긴 뒤에도 이 전제가 남아 **반려견 사진을 올려도 홈 프로필 ·
 * 스위처 · 마이페이지 행에는 이니셜만 떴다.** `/pets` 목록(`PetPhoto`)만 사진을 그렸다.
 *
 * `aria-hidden` 이다 — 이니셜·사진은 장식이고 이름은 항상 옆에 글자로 함께 있다.
 * 스크린리더가 "몽" 을 먼저 읽으면 이름이 두 번 읽힌다.
 *
 * ### `next/image` 가 아니라 `<img>` 인 이유 · 로드 실패 폴백
 *
 * `features/pet/pet-photo.tsx` 와 같다 — 업로드 호스트가 환경마다 달라 `remotePatterns` 에
 * 등록할 수 없고, 파일이 지워졌으면 깨진 이미지 대신 이니셜로 떨어진다.
 *
 * 홈 프로필(96/112)과 일정 목록(24~32)이 같은 것을 그린다. 이 파일이 생기기 전에는
 * 홈에만 두 벌이 인라인으로 있었다.
 */
const SIZE: Record<PetAvatarSize, string> = {
  /**
   * 모바일 반려견 칩 · 홈 이니셜 배지.
   *
   * 여행 일정 아트보드는 이 자리에 22 를 쓰지만 **24 로 맞췄다** — 홈이 같은 요소에
   * 이미 24 를 쓰고 있고, 칩 높이(36~44 · `Chip` 의 `size`)가 아바타보다 커서 2px 이 레이아웃을
   * 바꾸지 않는다. 두 화면이 같은 원형을 다른 크기로 그리는 편이 더 나쁘다.
   */
  sm: 'size-6 text-caption font-bold',
  /** 데스크톱 필터 레일 */
  md: 'size-7 text-caption font-bold',
  /** 데스크톱 일정 행 */
  lg: 'size-8 text-body-2 font-bold',
  /**
   * 마이페이지 `내 반려견` 행의 리딩 슬롯 (#468) — **같은 카드의 `저장한 장소` 가 쓰는
   * 40px 원형과 같은 값이다.** 두 행의 리딩이 같은 폭이어야 글줄이 한 세로선에 선다.
   */
  xl: 'size-10 text-body-1 font-bold',
  /** 홈 프로필 카드 — 96(모바일) / 112(데스크톱) */
  hero: 'size-24 md:size-28 text-avatar md:text-avatar-lg font-extrabold',
}

export function PetAvatar({
  name,
  /** `Pet.profileImageUrl`. 없거나 열리지 않으면 이니셜로 떨어진다 */
  url = null,
  size = 'sm',
  /** 선택되지 않은 항목은 중립 톤으로 물러난다 (아트보드 04·05 의 반려견 필터) */
  muted = false,
  className,
}: {
  name: string
  url?: string | null
  size?: PetAvatarSize
  muted?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  // URL 이 바뀌면 실패 기록을 지운다. 안 그러면 한 번 깨진 뒤 새 사진을 올려도
  // 계속 이니셜만 보인다 — 업로드 성공이 화면에 반영되지 않는다
  useEffect(() => {
    setFailed(false)
  }, [url])

  if (url !== null && url.length > 0 && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 위 주석: 업로드 호스트를 remotePatterns 에 등록할 수 없다
      <img
        src={url}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        className={cn(
          'bg-band shrink-0 rounded-full object-cover',
          // 선택되지 않은 사진은 채도를 빼 이니셜의 중립 톤과 같은 무게로 물러난다
          muted && 'opacity-60 grayscale',
          SIZE[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        muted ? 'bg-band text-fg-muted' : 'bg-metric-high-100 text-metric-high-700',
        SIZE[size],
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  )
}
