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
 * `/about` 밖에서는 `StateCharacter` 를 쓴다 — 그쪽이 래퍼까지 들고 있다.
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

/**
 * `/about` 밖에서 서는 자세 (#939, DESIGN.md §0-5).
 *
 * **앞발(`hot`) · 열기 선은 없다.** 둘은 소개 페이지 질문 2 가 "노면이 뜨겁다(위험)" 를
 * 연기하는 자세다. 다른 화면에서 쓰면 캐릭터가 판정 등급을 대신 말하게 된다 — 심볼을 등급
 * 색으로 칠하지 않는 것(`docs/hondi_img/README.md`)과 같은 이유로 타입에서 막는다.
 */
export type StateCharacterPose = 'sitLookup' | 'sitFront' | 'stand' | 'leash'

/**
 * 높이로 크기를 맞춘다 — **폭이 아니다.** 앉은 정면(`sitFront` 231×416)과 산책(`leash`
 * 440×408)은 비율이 두 배 가까이 달라, 폭을 맞추면 정면 개만 두 배 크게 선다. 앉은 개와 선
 * 개의 키는 비슷하므로 높이가 같으면 같은 개로 읽힌다.
 *
 * - `md` — 빈 화면 · 대기 화면. 72 → 768 이상 88. 여백이 아니라 오브젝트 크기라 DESIGN.md §4
 *   간격 스케일의 대상이 아니다(아이콘 · 썸네일과 같다)
 * - `sm` — 배너 안. 64. **꺾쇠를 뺀 자리를 캐릭터가 쓴다** (`Banner` 의 `character` 주석) —
 *   48 이던 때는 꺾쇠(20 + 간격 12)와 나란히 서서 설명 줄이 2px 차이로 두 줄로 넘어갔다
 */
const STATE_CHARACTER_SIZE = {
  md: 'h-18 md:h-22',
  sm: 'h-16',
} as const

/**
 * 빈 화면 · 대기 화면의 캐릭터 한 마리 (#939).
 *
 * **자리는 목록으로 정해져 있다** (DESIGN.md §0-5) — `character.test.ts` 가 이 컴포넌트를
 * 부르는 파일을 허용 목록과 대조한다. 새 자리에 쓰려면 규칙부터 고친다.
 *
 * - 스크린리더에 없다 — 래퍼가 `aria-hidden`, 그림은 `alt=""`
 * - 반복 애니메이션이 없다 — 정지 그림만으로 문장이 통해야 한다(움직임 줄이기 사용자 포함)
 * - `pointer-events-none` — 옆 버튼의 히트 영역을 가리지 않는다
 * - `w-max` — 폭은 그림이 높이에서 얻는다. 없으면 `absolute` 로 카드 바깥(`start-full`)에 둘 때
 *   남은 폭이 0 이라 shrink-to-fit 이 0 이 되어 개가 사라진다(인증 셸 1280 실측)
 *
 * `className` 은 **레이아웃 유틸리티만** 받는다 (component-guide.md §3).
 */
export function StateCharacter({
  pose,
  size = 'md',
  className,
}: {
  pose: StateCharacterPose
  size?: keyof typeof STATE_CHARACTER_SIZE
  className?: string
}) {
  return (
    <span
      aria-hidden
      data-character={pose}
      className={cn(
        'pointer-events-none block w-max shrink-0',
        STATE_CHARACTER_SIZE[size],
        className,
      )}
    >
      <CharacterImage name={pose} className="h-full w-auto" />
    </span>
  )
}
