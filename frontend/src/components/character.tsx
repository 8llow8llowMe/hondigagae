import Image from 'next/image'

import { cn } from '@/lib/utils/cn'

/**
 * 캐릭터 에셋 표 (#917 → #930, 소개 명세 2026-09-25 §6-4 · 확장 명세 2026-09-25 #939).
 *
 * **SVG 다** (#930). 시안 PNG 를 색마다 나눠 딴 평면 도형이고, 색은 기존 일러스트
 * (`public/illustrations/*.svg`)의 값을 그대로 쓰며 같은 `feTurbulence` 그레인을 한 겹 얹는다.
 * `width`/`height` 는 각 파일의 `viewBox` 와 같다 — `about-character.test.ts` 가 잠근다. 표를
 * 고치지 않고 파일만 바꾸면 테스트가 먼저 깨진다.
 *
 * 세 자세(산책 · 서기 · 앞발)는 같은 축척이라 `viewBox` 폭 비율이 곧 `globals.css` 의 폭 비율
 * (.936 · .904 · .981)이다. 다시 딸 때 축척을 바꾸면 그 비율도 같이 바꾼다.
 *
 * **경로가 아직 `illustrations/about/` 이다** (#939). `/about` 밖으로 넓히면서 옮길 수 있었지만
 * 소개 페이지 테스트가 이 경로로 캐릭터를 골라내고, 파일 여섯의 이동이 PR 예산을 먹는다.
 */
export const CHARACTER = {
  sitLookup: { src: '/illustrations/about/dog-sit-lookup.svg', width: 691, height: 836 },
  leash: { src: '/illustrations/about/dog-leash.svg', width: 440, height: 408 },
  stand: { src: '/illustrations/about/dog-stand.svg', width: 425, height: 413 },
  hot: { src: '/illustrations/about/dog-hot.svg', width: 461, height: 340 },
  heatLines: { src: '/illustrations/about/heat-lines.svg', width: 119, height: 131 },
  sitFront: { src: '/illustrations/about/dog-sit-front.svg', width: 231, height: 416 },
} as const

export type CharacterName = keyof typeof CHARACTER

/**
 * 캐릭터 한 장 — `alt=""` 다. 내용을 더하지 않는 그림이라 스크린리더가 건너뛴다(소개 명세 §8).
 * **감싸는 요소가 `aria-hidden` 을 갖는다** — 이 컴포넌트를 쓰는 쪽의 몫이다.
 *
 * 크기는 CSS 가 준다. `width`/`height` 속성은 비율과 레이아웃 자리 잡기에만 쓴다.
 */
export function CharacterImage({
  name,
  eager = false,
  className,
}: {
  name: CharacterName
  /** 첫 화면에 보이는 자리(히어로)만 — 나머지는 `next/image` 기본값(lazy) */
  eager?: boolean
  className?: string
}) {
  const asset = CHARACTER[name]

  return (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      draggable={false}
      className={cn('block h-auto select-none', className)}
    />
  )
}
