import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * DESIGN.md §3-2 의 커스텀 타이포 스케일.
 *
 * tailwind-merge 는 `text-*` 를 "글자 크기"와 "글자 색" 두 그룹으로 나눠 판정하는데,
 * 커스텀 스케일 이름(`text-caption` 등)을 모르면 색 유틸리티와 같은 그룹으로 오인해
 * **뒤에 온 것만 남기고 앞의 것을 지운다.**
 *
 * 실제로 `cn('text-fg-muted', 'text-caption')` 이 `text-fg-muted` 를 삭제해
 * 배지 색 매핑이 전부 죽어 있었다. 아래 등록이 그것을 막는다.
 *
 * **DESIGN.md §3-2 에 타이포 토큰을 추가하면 이 목록도 함께 갱신한다.**
 * 회귀 방지 테스트는 `cn.test.ts`.
 */
const TYPOGRAPHY_SCALE = [
  'page',
  'display',
  'avatar',
  'avatar-lg',
  'emphasis',
  'title-1',
  'title-2',
  'body-1',
  'body-2',
  'caption',
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPOGRAPHY_SCALE] }],
    },
  },
})

/**
 * 조건부 클래스를 병합한다.
 * 컴포넌트가 받는 `className` 은 레이아웃 유틸리티 용도로만 허용한다
 * (색·radius·shadow·padding 덮어쓰기 금지 — docs/component-guide.md §3).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
