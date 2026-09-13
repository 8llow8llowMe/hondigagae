import { cn } from '@/lib/utils/cn'

export type PetAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

/**
 * 반려견 이니셜 원형.
 *
 * **원형은 사진·아바타에만 허용된 곡선이다** (DESIGN.md §5). 폴백 순서는
 * 업로드 → 견종 일러스트 → 이니셜인데 백엔드에 사진 필드가 없어 지금은 이니셜뿐이다.
 * **빈 원형을 남기지 않는다.**
 *
 * `aria-hidden` 이다 — 이니셜은 장식이고 이름은 항상 옆에 글자로 함께 있다.
 * 스크린리더가 "몽" 을 먼저 읽으면 이름이 두 번 읽힌다.
 *
 * 홈 프로필(96/112)과 일정 목록(24~32)이 같은 것을 그린다. 이 파일이 생기기 전에는
 * 홈에만 두 벌이 인라인으로 있었다.
 */
const SIZE: Record<PetAvatarSize, string> = {
  /**
   * 모바일 반려견 칩 · 홈 이니셜 배지.
   *
   * 여행 일정 아트보드는 이 자리에 22 를 쓰지만 **24 로 맞췄다** — 홈이 같은 요소에
   * 이미 24 를 쓰고 있고, 칩의 높이는 최소 터치 영역(44)이 정하므로 2px 이 레이아웃을
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
  size = 'sm',
  /** 선택되지 않은 항목은 중립 톤으로 물러난다 (아트보드 04·05 의 반려견 필터) */
  muted = false,
  className,
}: {
  name: string
  size?: PetAvatarSize
  muted?: boolean
  className?: string
}) {
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
