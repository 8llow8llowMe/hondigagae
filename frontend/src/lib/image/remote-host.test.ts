import { describe, expect, it } from 'vitest'

import { isAllowedImageHost } from '@/lib/image/remote-host'

describe('isAllowedImageHost', () => {
  it('next.config 에 등록된 호스트는 허용한다', () => {
    expect(isAllowedImageHost('http://tong.visitkorea.or.kr/cms/resource/1.jpg')).toBe(true)
    expect(isAllowedImageHost('https://tong.visitkorea.or.kr/cms/resource/1.jpg')).toBe(true)
  })

  it('등록되지 않은 호스트는 거부한다 — next/image 가 런타임에 던지는 것을 막는다', () => {
    expect(isAllowedImageHost('https://cdn.example.com/1.jpg')).toBe(false)
  })

  it('하위 도메인을 흉내 낸 호스트를 허용하지 않는다', () => {
    expect(isAllowedImageHost('https://tong.visitkorea.or.kr.evil.com/1.jpg')).toBe(false)
  })

  it('http / https 가 아닌 스킴은 거부한다', () => {
    expect(isAllowedImageHost('javascript:alert(1)')).toBe(false)
    expect(isAllowedImageHost('data:image/png;base64,AAAA')).toBe(false)
  })

  it('URL 이 아니거나 비어 있으면 거부한다', () => {
    expect(isAllowedImageHost('그냥 문자열')).toBe(false)
    expect(isAllowedImageHost('')).toBe(false)
    expect(isAllowedImageHost(null)).toBe(false)
  })
})
