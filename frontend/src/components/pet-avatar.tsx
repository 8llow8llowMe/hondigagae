'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils/cn'

export type PetAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

/**
 * 사진 자리의 기본 그림 (#1022) — `dog-sit-lookup.svg` 를 **새로 그리지 않고** `viewBox` 만
 * 정사각(`-154 -95 1000 1000`)으로 바꿔 원 안에 앉힌 사본이다. 원 지름의 약 81% 를 개가
 * 차지하고 꼬리 끝까지 원 안에 든다.
 *
 * **캐릭터(`StateCharacter`)가 아니다** — 자세로 문장을 연기하지 않고, 원 밖으로 나오지 않고,
 * 사진을 올리면 사라진다. 그래서 `DESIGN.md` §0-5 의 자리 목록 밖이고 경로도
 * `illustrations/about/` 이 아니다 (§0-5 "사진 자리의 기본값" 예외).
 */
export const PET_AVATAR_DEFAULT = {
  src: '/illustrations/pet-avatar-default.svg',
  width: 1000,
  height: 1000,
} as const

/**
 * 반려견 아바타 원형 — 사진이 있으면 사진, 없으면 **40 이상은 기본 그림, 그 아래는 이니셜**.
 *
 * **원형은 사진·아바타에만 허용된 곡선이다** (DESIGN.md §5). 폴백 순서는
 * 업로드 → 견종 일러스트 → 이니셜이다. 견종별 그림은 자료가 없어 **한 장의 기본 그림**이
 * 가운데 단계를 맡는다 (#1022). **빈 원형을 남기지 않는다.**
 *
 * **24~32 칩은 이니셜 그대로다** (#1022). 크림색 개가 회색 원 안에서 24 로 줄면 형체가
 * 뭉개져 얼룩으로 읽힌다 — 칩은 옆에 이름이 늘 붙어 있어 이니셜로도 충분하다.
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
 * 등록할 수 없고, 파일이 지워졌으면 깨진 이미지 대신 기본 그림 · 이니셜로 떨어진다.
 * 기본 그림은 우리 정적 자산이라 `next/image` 다 (`CharacterImage` 와 같다).
 *
 * 홈 프로필(80/96)과 일정 목록(24~32)이 같은 것을 그린다. 이 파일이 생기기 전에는
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
  /**
   * 홈 프로필 카드 — 80(모바일) / 96(데스크톱).
   *
   * **96/112 에서 한 단 내렸다** (#1022). 이 카드는 `[누구 · 지금 안전한가 · 언제]` 이고 답은
   * 판정인데, 프로필 블록이 판정보다 높았다. 사진 · 기본 그림은 이니셜보다 색이 많아 더
   * 무겁다. 이 크기에서는 이니셜을 그리지 않으므로 글자 크기를 두지 않는다.
   */
  hero: 'size-20 md:size-24',
}

/** 기본 그림을 그리는 크기 — 40 이상. 그 아래는 형체가 뭉개진다 (위 머리주석) */
const ILLUSTRATED: ReadonlySet<PetAvatarSize> = new Set(['xl', 'hero'])

export function PetAvatar({
  name,
  /** `Pet.profileImageUrl`. 없거나 열리지 않으면 기본 그림 · 이니셜로 떨어진다 */
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

  if (ILLUSTRATED.has(size)) {
    return (
      <Image
        src={PET_AVATAR_DEFAULT.src}
        width={PET_AVATAR_DEFAULT.width}
        height={PET_AVATAR_DEFAULT.height}
        alt=""
        aria-hidden
        draggable={false}
        className={cn(
          'bg-band shrink-0 rounded-full select-none',
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
