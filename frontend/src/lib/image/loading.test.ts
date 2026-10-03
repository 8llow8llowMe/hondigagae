import { describe, expect, it } from 'vitest'

import { imageLoadingProps } from '@/lib/image/loading'

describe('imageLoadingProps — 첫 화면 사진만 먼저 받는다 (#1132)', () => {
  it('첫 화면이면 바로 받고 우선순위를 올린다', () => {
    expect(imageLoadingProps(true)).toEqual({ loading: 'eager', fetchPriority: 'high' })
  })

  it('나머지는 지연 로드다 — 우선순위를 건드리지 않는다', () => {
    expect(imageLoadingProps(false)).toEqual({ loading: 'lazy' })
  })
})
