import { describe, expect, it, vi } from 'vitest'

import { copyText, placeShareUrl, sharePlace } from '@/lib/place/share'

const target = { title: '수월봉', url: 'https://hondi.example/places/126434' }

function abort() {
  return Object.assign(new Error('closed'), { name: 'AbortError' })
}

describe('placeShareUrl — 상세 정규 주소를 공유한다 (#1233)', () => {
  it('지도 주소(?place=)가 아니라 상세 주소다', () => {
    expect(placeShareUrl('https://hondi.example', '126434')).toBe(
      'https://hondi.example/places/126434',
    )
  })
})

describe('sharePlace — 공유 시트 → 링크 복사', () => {
  it('공유 시트가 있으면 그것을 연다 — 복사하지 않는다', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()

    await expect(sharePlace({ share, clipboard: { writeText } }, target)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(target)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('공유 시트가 없으면 링크를 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(sharePlace({ clipboard: { writeText } }, target)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(target.url)
  })

  it('사용자가 시트를 닫으면(AbortError) 실패가 아니다 — 복사도 알림도 없다', async () => {
    const share = vi.fn().mockRejectedValue(abort())
    const writeText = vi.fn()

    await expect(sharePlace({ share, clipboard: { writeText } }, target)).resolves.toBe('canceled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('시트가 거절되면(AbortError 밖) 링크 복사로 넘어간다', async () => {
    const share = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(sharePlace({ share, clipboard: { writeText } }, target)).resolves.toBe('copied')
  })

  it('클립보드도 막히면 실패다', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))

    await expect(sharePlace({ clipboard: { writeText } }, target)).resolves.toBe('failed')
    await expect(sharePlace({}, target)).resolves.toBe('failed')
  })

  it('이 URL 을 실을 수 없다고(canShare) 하면 시트를 열지 않고 복사한다', async () => {
    const share = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)

    await expect(
      sharePlace({ share, canShare: () => false, clipboard: { writeText } }, target),
    ).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
  })
})

describe('copyText', () => {
  it('복사되면 참, 클립보드가 없거나 막히면 거짓', async () => {
    await expect(
      copyText({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } }, 'a'),
    ).resolves.toBe(true)
    await expect(
      copyText({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('x')) } }, 'a'),
    ).resolves.toBe(false)
    await expect(copyText({}, 'a')).resolves.toBe(false)
  })
})
