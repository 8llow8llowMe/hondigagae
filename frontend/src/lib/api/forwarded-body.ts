/**
 * BFF 가 게이트웨이로 그대로 넘길 요청 본문.
 *
 * 이 저장소의 첫 파일 업로드(`POST /members/me/profile-image`)가 생기기 전까지는
 * "본문 = JSON 문자열" 이라고 가정해도 됐다. **`multipart/form-data` 는 그 가정을 깬다** —
 * 파트 경계(boundary)가 `Content-Type` 헤더에 있고 본문은 바이너리다.
 *
 * docs/architecture-guide.md §5, docs/features/member/공통명세.md S3
 */

/** 게이트웨이로 보낼 본문 한 벌. **헤더와 데이터는 짝이라 따로 다루지 않는다.** */
export type ForwardedBody = {
  /**
   * 원본 `Content-Type`. multipart 는 여기에 boundary 가 들어 있어
   * **반드시 원본 문자열을 그대로 보존해야 한다.** 새로 만들면 파싱이 실패한다.
   */
  contentType: string
  /**
   * 문자열(JSON) 또는 바이너리(multipart).
   *
   * **스트림이 아니라 버퍼다.** 401 → reissue 후 원 요청을 재시도할 때 본문을 두 번
   * 읽어야 하는데, 스트림은 한 번 흘리면 끝이다. 대신 업로드가 통째로 메모리에 올라온다 —
   * 서버가 `max-file-size: 5MB` / `max-request-size: 30MB` 로 막고, 화면도 업로드 전에
   * 크기를 검사해 여기까지 큰 것이 오지 않게 한다.
   */
  data: string | ArrayBuffer
}

/** 본문을 읽는 데 필요한 것만. 테스트가 표준 `Request` 를 그대로 넣을 수 있게 좁게 잡는다 */
type BodyRequest = Pick<Request, 'method' | 'headers' | 'text' | 'arrayBuffer'>

const MULTIPART_PREFIX = 'multipart/form-data'
const JSON_CONTENT_TYPE = 'application/json'

/** 본문이 없는 메서드. 있어도 게이트웨이가 읽지 않는다 */
const BODYLESS_METHODS = new Set(['GET', 'DELETE'])

/**
 * `multipart/form-data` 인가. 뒤에 `; boundary=...` 가 붙으므로 **접두사로 판정**한다.
 */
export function isMultipart(contentType: string | null | undefined): boolean {
  return (contentType ?? '').trimStart().toLowerCase().startsWith(MULTIPART_PREFIX)
}

/**
 * 요청 본문을 게이트웨이로 넘길 형태로 읽는다. 본문이 없으면 `null` 이다.
 *
 * multipart 가 아니면 **`Content-Type` 을 `application/json` 으로 고정한다** — 이 저장소의
 * 브라우저 클라이언트(`client.ts`)는 JSON 아니면 multipart 만 보내고, 그 외 타입을
 * 통과시키면 게이트웨이가 무엇을 받는지 BFF 가 모르게 된다.
 */
export async function readForwardedBody(request: BodyRequest): Promise<ForwardedBody | null> {
  if (BODYLESS_METHODS.has(request.method)) return null

  const contentType = request.headers.get('content-type')

  if (isMultipart(contentType)) {
    // text() 로 읽으면 UTF-8 로 해석되면서 바이너리가 깨진다. 그대로 들고 간다.
    const data = await request.arrayBuffer()
    if (data.byteLength === 0) return null
    // isMultipart 가 참이면 contentType 은 문자열이다
    return { contentType: contentType as string, data }
  }

  const text = await request.text()
  if (text === '') return null

  return { contentType: JSON_CONTENT_TYPE, data: text }
}

/**
 * mock 계층에 넘길 본문 문자열.
 *
 * **mock 은 파일을 저장하지 않는다.** 바이너리는 해석할 것이 없으므로 `null` 을 준다 —
 * multipart 를 받는 mock 은 경로와 메서드만 보고 고정 응답을 낸다.
 */
export function toMockBody(body: ForwardedBody | null): string | null {
  if (body === null || typeof body.data !== 'string') return null
  return body.data
}
