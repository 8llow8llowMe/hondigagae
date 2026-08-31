import { afterEach, describe, expect, it, vi } from 'vitest'

import { clientFetchForm } from '@/lib/api/client'
import { ApiError } from '@/lib/api/error'

/**
 * 파일 업로드 전송 계약.
 *
 * **이 파일이 지키는 것은 한 줄이다: `Content-Type` 을 직접 지정하지 않는다.**
 * multipart 는 파트 경계(boundary)가 헤더에 들어가는데 그 값은 `fetch` 가 `FormData` 를
 * 보고 만든다. 손으로 `'multipart/form-data'` 를 적으면 boundary 가 빠지고, 서버는
 * 파싱에 실패하면서 "파일이 없다"(`STORAGE_001`)에 가까운 오류를 낸다 — 원인이
 * 헤더에 있어서 찾는 데 오래 걸린다.
 */
type FetchCall = { url: string; init: RequestInit }

function stubFetch(status: number, payload: unknown): FetchCall[] {
  const calls: FetchCall[] = []

  vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }) as unknown as typeof globalThis.fetch)

  return calls
}

function form(): FormData {
  const data = new FormData()
  data.append('imageFile', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'dog.png')
  return data
}

const OK = {
  dataHeader: { success: true, resultCode: null, resultMessage: null },
  dataBody: { profileImageKey: 'members/profiles/a.png', profileImageUrl: 'http://h/a.png' },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('clientFetchForm', () => {
  it('Content-Type 을 지정하지 않는다 — boundary 를 fetch 가 만든다', async () => {
    const calls = stubFetch(200, OK)

    await clientFetchForm('/members/me/profile-image', { body: form() })

    expect(calls[0]?.init.headers).toBeUndefined()
  })

  it('FormData 를 그대로 보낸다 — JSON 으로 직렬화하지 않는다', async () => {
    const calls = stubFetch(200, OK)
    const body = form()

    await clientFetchForm('/members/me/profile-image', { body })

    expect(calls[0]?.init.body).toBe(body)
  })

  it('BFF 를 거친다 — 게이트웨이를 직접 부르지 않는다', async () => {
    const calls = stubFetch(200, OK)

    await clientFetchForm('/members/me/profile-image', { body: form() })

    expect(calls[0]?.url).toBe('/api/bff/members/me/profile-image')
  })

  it('기본 메서드는 POST 다', async () => {
    const calls = stubFetch(200, OK)

    await clientFetchForm('/members/me/profile-image', { body: form() })

    expect(calls[0]?.init.method).toBe('POST')
  })

  it('dataBody 를 꺼내 준다 — 공통 래퍼 판별을 건너뛰지 않는다', async () => {
    stubFetch(200, OK)

    const result = await clientFetchForm<{ profileImageUrl: string }>('/members/me/profile-image', {
      body: form(),
    })

    expect(result.profileImageUrl).toBe('http://h/a.png')
  })

  /** 형식·크기 오류는 400 + STORAGE_00x 로 온다. 화면이 resultMessage 를 그대로 쓴다 */
  it('실패 응답을 ApiError 로 던진다 — resultCode 를 보존한다', async () => {
    stubFetch(400, {
      dataHeader: {
        success: false,
        resultCode: 'STORAGE_003',
        resultMessage: '지원하지 않는 파일 형식입니다. (jpg, png, gif, webp 이미지만 가능)',
      },
      dataBody: null,
    })

    await expect(
      clientFetchForm('/members/me/profile-image', { body: form() }),
    ).rejects.toMatchObject({ status: 400, resultCode: 'STORAGE_003' })
  })

  it('네트워크 무응답은 status 0 인 ApiError 다 — 재시도 UI 로 이어진다', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

    const error = await clientFetchForm('/members/me/profile-image', { body: form() }).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
  })
})
