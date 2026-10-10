import { describe, expect, it } from 'vitest'

import { isMultipart, readForwardedBody, toMockBody } from '@/lib/api/forwarded-body'

function request(method: string, body: BodyInit | null = null, contentType?: string): Request {
  const headers: HeadersInit = contentType === undefined ? {} : { 'content-type': contentType }
  return new Request('http://localhost/api/bff/members/me', { method, body, headers })
}

/** 파일 업로드 요청 한 벌. boundary 는 FormData 를 넘기면 런타임이 만들어 준다 */
function uploadRequest(bytes: Uint8Array<ArrayBuffer>): Request {
  const form = new FormData()
  form.append('imageFile', new Blob([bytes], { type: 'image/png' }), 'dog.png')
  return request('POST', form)
}

describe('isMultipart', () => {
  it('boundary 가 뒤에 붙어도 알아본다 — 접두사로 판정한다', () => {
    expect(isMultipart('multipart/form-data; boundary=----abc123')).toBe(true)
  })

  it('대소문자와 앞 공백을 가리지 않는다', () => {
    expect(isMultipart('  Multipart/Form-Data; boundary=x')).toBe(true)
  })

  it('JSON 과 빈 값은 아니다', () => {
    expect(isMultipart('application/json')).toBe(false)
    expect(isMultipart(null)).toBe(false)
    expect(isMultipart(undefined)).toBe(false)
  })
})

describe('readForwardedBody', () => {
  it('GET · DELETE 는 본문을 읽지 않는다', async () => {
    expect(await readForwardedBody(request('GET'))).toBeNull()
    expect(await readForwardedBody(request('DELETE'))).toBeNull()
  })

  it('빈 본문은 null 이다 — Content-Type 을 붙이지 않게 한다', async () => {
    expect(await readForwardedBody(request('POST', ''))).toBeNull()
  })

  it('JSON 은 문자열로 읽고 Content-Type 을 고정한다', async () => {
    const body = await readForwardedBody(
      request('PATCH', '{"nickname":"초코"}', 'application/json'),
    )

    expect(body).toEqual({ contentType: 'application/json', data: '{"nickname":"초코"}' })
  })

  it('Content-Type 이 없어도 JSON 으로 넘긴다 — 기존 동작 그대로다', async () => {
    const body = await readForwardedBody(request('POST', '{"a":1}'))

    expect(body?.contentType).toBe('application/json')
  })

  it('multipart 는 원본 Content-Type 을 그대로 보존한다 — boundary 가 그 안에 있다', async () => {
    const incoming = uploadRequest(new Uint8Array([1, 2, 3]))
    const original = incoming.headers.get('content-type')

    const body = await readForwardedBody(incoming)

    expect(body?.contentType).toBe(original)
    expect(body?.contentType).toContain('boundary=')
  })

  it('multipart 본문은 바이너리 그대로다 — 문자열로 읽으면 깨진다', async () => {
    // UTF-8 로 해석하면 손실되는 바이트열 (0x80~0xFF 단독은 유효한 UTF-8 이 아니다)
    const raw = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xd8, 0x00, 0x80])

    const body = await readForwardedBody(uploadRequest(raw))

    expect(body?.data).toBeInstanceOf(ArrayBuffer)

    const forwarded = new Uint8Array(body?.data as ArrayBuffer)
    // 파트 본문 안에 원본 바이트열이 그대로 들어 있어야 한다
    expect(indexOfBytes(forwarded, raw)).toBeGreaterThanOrEqual(0)
  })

  it('읽어 둔 본문은 두 번 보낼 수 있다 — 401 재시도가 같은 파일을 다시 올린다', async () => {
    const body = await readForwardedBody(uploadRequest(new Uint8Array([7, 7, 7])))

    // 버퍼라서 소비되지 않는다. 스트림이었다면 두 번째가 빈 본문이 된다
    const first = new Uint8Array(body?.data as ArrayBuffer)
    const second = new Uint8Array(body?.data as ArrayBuffer)

    expect(second.byteLength).toBe(first.byteLength)
    expect(second.byteLength).toBeGreaterThan(0)
  })
})

describe('toMockBody', () => {
  it('JSON 은 그대로 넘긴다', () => {
    expect(toMockBody({ contentType: 'application/json', data: '{"a":1}' })).toBe('{"a":1}')
  })

  it('바이너리는 null 이다 — mock 은 파일을 저장하지 않는다', () => {
    expect(
      toMockBody({ contentType: 'multipart/form-data; boundary=x', data: new ArrayBuffer(8) }),
    ).toBeNull()
  })

  it('본문이 없으면 null 이다', () => {
    expect(toMockBody(null)).toBeNull()
  })
})

/** haystack 안에서 needle 이 시작하는 위치. 없으면 -1 */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}
