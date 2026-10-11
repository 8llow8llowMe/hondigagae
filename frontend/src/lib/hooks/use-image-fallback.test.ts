import { describe, expect, it } from 'vitest'

import { isBrokenImage } from '@/lib/hooks/use-image-fallback'

/**
 * `useImageFallback` 의 판정 조각 — 이슈 #1382.
 *
 * 훅 자체는 node 환경에서 렌더할 수 없어(`testing-guide.md` §1) **마운트 때 읽는 판정
 * 함수만 잰다.** 서버 렌더된 `<img>` 가 하이드레이션 전에 실패하면 `onError` 가 불리지
 * 않으므로(#1382), 이 판정이 그 경우를 잡는 유일한 길이다.
 */
describe('isBrokenImage', () => {
  it('로드가 끝났는데 크기가 0 이면 깨진 이미지다 — 하이드레이션 전에 404 가 난 경우', () => {
    expect(isBrokenImage({ complete: true, naturalWidth: 0 })).toBe(true)
  })

  it('로드가 끝나고 크기가 있으면 정상이다', () => {
    expect(isBrokenImage({ complete: true, naturalWidth: 640 })).toBe(false)
  })

  it('아직 받는 중이면 단정하지 않는다 — 실패는 그 뒤 onError 가 알린다', () => {
    expect(isBrokenImage({ complete: false, naturalWidth: 0 })).toBe(false)
  })

  it('img 가 없으면(이미 기본 그림을 그리는 중) 실패가 아니다 — URL 이 바뀌면 다시 사진을 시도한다', () => {
    expect(isBrokenImage(null)).toBe(false)
  })
})
