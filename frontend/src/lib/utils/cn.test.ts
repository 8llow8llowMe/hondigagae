import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils/cn'

/**
 * tailwind-merge 가 커스텀 타이포 스케일을 글자 색으로 오인해 지우는 회귀를 막는다.
 * 이 버그로 배지 색 매핑이 전부 죽어 모든 배지가 기본 색으로 렌더된 적이 있다.
 */
describe('cn — 타이포 토큰과 색 토큰이 서로를 지우지 않는다', () => {
  it.each([
    ['text-caption', 'text-fg-muted'],
    ['text-caption', 'text-brand-700'],
    ['text-body-2', 'text-warn-700'],
    ['text-button', 'text-fg-inverse'],
    ['text-display', 'text-danger-500'],
    ['text-title-1', 'text-fg'],
  ])('%s 와 %s 를 함께 유지한다', (size, color) => {
    const result = cn(size, color).split(' ')

    expect(result).toContain(size)
    expect(result).toContain(color)
  })

  it('순서를 바꿔도 둘 다 유지한다', () => {
    const result = cn('text-fg-muted', 'text-caption').split(' ')

    expect(result).toContain('text-fg-muted')
    expect(result).toContain('text-caption')
  })
})

describe('cn — 같은 그룹은 여전히 뒤에 온 것이 이긴다', () => {
  it('타이포 스케일끼리는 마지막 값만 남는다', () => {
    expect(cn('text-body-2', 'text-caption')).toBe('text-caption')
  })

  it('색끼리는 마지막 값만 남는다', () => {
    expect(cn('text-fg-muted', 'text-fg')).toBe('text-fg')
  })

  it('className 으로 레이아웃을 덮어쓸 수 있다', () => {
    expect(cn('mt-2', 'mt-4')).toBe('mt-4')
  })
})
