import Image from 'next/image'

import { Reveal } from '@/features/about/reveal'
import { cn } from '@/lib/utils/cn'

/**
 * 소개 페이지 캐릭터 에셋 표 (#917 → #930, 명세 2026-09-25 §6-4).
 *
 * **SVG 다** (#930). 시안 PNG 를 색마다 나눠 딴 평면 도형이고, 색은 기존 일러스트
 * (`public/illustrations/*.svg`)의 값을 그대로 쓰며 같은 `feTurbulence` 그레인을 한 겹 얹는다.
 * `width`/`height` 는 각 파일의 `viewBox` 와 같다 — `about-character.test.ts` 가 잠근다. 표를
 * 고치지 않고 파일만 바꾸면 테스트가 먼저 깨진다.
 *
 * 세 자세(산책 · 서기 · 앞발)는 같은 축척이라 `viewBox` 폭 비율이 곧 `globals.css` 의 폭 비율
 * (.936 · .904 · .981)이다. 다시 딸 때 축척을 바꾸면 그 비율도 같이 바꾼다.
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
 * 캐릭터 한 장 — `alt=""` 다. 내용을 더하지 않는 그림이라 스크린리더가 건너뛴다(명세 §8).
 * **감싸는 요소가 `aria-hidden` 을 갖는다** — 이 컴포넌트를 쓰는 쪽의 몫이다.
 *
 * 크기는 CSS 가 폭으로 준다(`globals.css` 캐릭터 블록). `width`/`height` 속성은 비율과 레이아웃
 * 자리 잡기에만 쓴다.
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

/**
 * 히어로 — 앉아서 판정 카드를 올려다본다 (명세 §6-2).
 *
 * 판정 카드와 같은 패럴랙스 래퍼 안에 `absolute` 로 선다 — 카드가 거슬러 오르면 같이 오른다.
 * 1024 이상은 카드 왼쪽 바깥(카피 열과 카드 열 사이), 그 미만은 카드 **아래** 왼쪽에서 발을
 * 절 끝선에 댄다. 모바일에서 카드 모서리에 겹치면 카드 맨 아래 캡션 · 이유 줄을 가린다.
 *
 * 제목 어절이 다 올라온 뒤(500ms) 한 번 올라온다 — `.about-split-word` 와 같은 keyframes.
 */
export function HeroDog() {
  return (
    <span aria-hidden className="about-hero-dog">
      <CharacterImage name="sitLookup" eager className="w-full" />
    </span>
  )
}

/**
 * 마무리 CTA — 정면으로 앉는다 (명세 §6-2). 1024 이상은 7:5 의 오른쪽 열, 그 미만은 버튼 아래
 * 오른쪽이고 어느 쪽이든 **절 끝선에 발을 댄다**(음수 아래 여백 = 밴드 아래 패딩).
 *
 * 등장은 `Reveal` 한 번이다 — 반복하지 않는다.
 */
export function CtaDog({ className }: { className?: string }) {
  return (
    <Reveal className={cn('about-cta-dog', className)}>
      <span aria-hidden className="block">
        <CharacterImage name="sitFront" className="w-full" />
      </span>
    </Reveal>
  )
}
