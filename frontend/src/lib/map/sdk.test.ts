import { describe, expect, it } from 'vitest'

import { kakaoSdkUrl, loadKakaoMaps, MapSdkError, resetKakaoMapsLoaderForTest } from '@/lib/map/sdk'

describe('kakaoSdkUrl', () => {
  it('autoload=false 를 반드시 붙인다 — 빠뜨리면 느린 회선에서만 깨진다', () => {
    expect(kakaoSdkUrl('key-1')).toContain('autoload=false')
  })

  it('쓰지 않는 libraries 를 싣지 않는다 — 묶음은 lib/map/cluster.ts 가 계산한다', () => {
    expect(kakaoSdkUrl('key-1')).not.toContain('libraries')
  })

  it('앱 키를 인코딩해 싣는다', () => {
    expect(kakaoSdkUrl('a b')).toContain('appkey=a+b')
  })

  it('dapi.kakao.com 이외의 호스트를 만들지 않는다', () => {
    expect(new URL(kakaoSdkUrl('key-1')).origin).toBe('https://dapi.kakao.com')
  })
})

describe('loadKakaoMaps', () => {
  it('서버(document 없음)에서는 unsupported 로 거절한다', async () => {
    resetKakaoMapsLoaderForTest()

    await expect(loadKakaoMaps()).rejects.toBeInstanceOf(MapSdkError)
  })

  it('실패한 로드를 캐시하지 않는다 — 재시도가 영원히 같은 실패를 재생하면 안 된다', async () => {
    resetKakaoMapsLoaderForTest()

    const first = await loadKakaoMaps().catch((error: unknown) => error)
    const second = await loadKakaoMaps().catch((error: unknown) => error)

    expect(first).not.toBe(second)
  })
})
