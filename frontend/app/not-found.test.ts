import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 전역 404 탭 제목 — 이슈 #676.
 *
 * **소스를 문자열로 읽는다.** 이 파일의 기본 export 는 `readSession()` 을 부르는 async
 * 서버 컴포넌트라 `renderToStaticMarkup` 으로 렌더할 방법이 없다 (`testing-guide.md` §1,
 * `src/test/source.ts` 머리주석). 여기서 지키려는 것도 렌더 결과가 아니라 **`metadata` 가
 * 본문 `h1` 과 같은 상수(`messages.common.notFoundTitle`)에서 나오는가**다.
 *
 * `export const metadata` 가 없으면 루트 레이아웃의 기본 제목(`혼디가개`)으로 떨어져
 * 탭·북마크·공유 카드에 "없는 주소" 라는 사실이 실리지 않는다 — 이 이슈의 원인 그대로다.
 */
const source = readSourceWithoutComments('app/not-found.tsx')

describe('전역 404 — 탭 제목 (#676)', () => {
  it('metadata.title 이 본문과 같은 상수를 쓴다', () => {
    expect(source).toContain('export const metadata: Metadata = {')
    expect(source).toContain('title: `${messages.common.notFoundTitle} · 혼디가개`')

    // h1 도 같은 상수를 쓴다 — 새 문자열을 짓지 않는다
    expect(source).toContain('<h1 className="sr-only">{messages.common.notFoundTitle}</h1>')
  })

  it('접미사는 U+00B7 MIDDLE DOT 양옆 한 칸이다 — 세그먼트 404 와 같은 모양', () => {
    expect(source).toContain('· 혼디가개')
  })

  it('실제 문구는 "없는 주소예요 · 혼디가개" 다', () => {
    expect(`${messages.common.notFoundTitle} · 혼디가개`).toBe('없는 주소예요 · 혼디가개')
  })
})
