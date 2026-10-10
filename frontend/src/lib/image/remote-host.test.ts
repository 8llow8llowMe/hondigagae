import { describe, expect, it } from 'vitest'

import { imageSrc, isAllowedImageHost } from '@/lib/image/remote-host'

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

describe('imageSrc — 허용 판정과 https 승격을 한 번에 한다', () => {
  /*
    **실데이터가 http 로 온다.** dev 게이트웨이 실측: `firstImage` 가
    `http://tong.visitkorea.or.kr/cms/resource/90/3444890_image2_1.jpg` 다.
    `next.config.ts` 가 `unoptimized: true` 라 이 URL 이 브라우저에 그대로 나가고,
    https 로 서비스되는 dev·prod 에서는 **mixed content 로 차단된다.**
    같은 파일을 https 로 받아도 200 · 동일 바이트라 승격이 안전하다.
  */
  it('허용 호스트의 http 를 https 로 올린다', () => {
    expect(imageSrc('http://tong.visitkorea.or.kr/cms/resource/90/a.jpg')).toBe(
      'https://tong.visitkorea.or.kr/cms/resource/90/a.jpg',
    )
  })

  it('이미 https 면 그대로 둔다', () => {
    expect(imageSrc('https://tong.visitkorea.or.kr/cms/resource/90/a.jpg')).toBe(
      'https://tong.visitkorea.or.kr/cms/resource/90/a.jpg',
    )
  })

  it('경로·쿼리·포트를 보존한다 — URL 재조립이 원본을 바꾸지 않는다', () => {
    expect(imageSrc('http://tong.visitkorea.or.kr/a/b.jpg?v=2')).toBe(
      'https://tong.visitkorea.or.kr/a/b.jpg?v=2',
    )
  })

  /** 미등록 호스트를 `next/image` 에 넘기면 런타임에 던진다 — 호출부가 플레이스홀더로 떨어뜨린다 */
  it('허용되지 않는 값은 null 이다', () => {
    expect(imageSrc('https://cdn.example.com/1.jpg')).toBe(null)
    expect(imageSrc('javascript:alert(1)')).toBe(null)
    expect(imageSrc('')).toBe(null)
    expect(imageSrc(null)).toBe(null)
  })
})
