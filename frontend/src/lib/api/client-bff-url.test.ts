import { describe, expect, it } from 'vitest'

import { bffUrl } from '@/lib/api/client'

describe('bffUrl', () => {
  /*
    **base 를 호출부가 다시 적으면 안 된다.** `EventSource` 처럼 `clientFetch` 를 쓸 수 없는
    전송이 base 를 손으로 적기 시작하면 게이트웨이를 직접 부르는 실수로 이어진다
    (`CLAUDE.md` 절대 규칙 — 브라우저는 백엔드를 직접 부르지 않는다).
  */
  it('BFF 프록시 base 를 붙인다', () => {
    expect(bffUrl('/ai-plans/jobs/abc/stream')).toBe('/api/bff/ai-plans/jobs/abc/stream')
  })

  it('절대 URL 을 만들지 않는다 — 같은 오리진이라 쿠키가 실린다', () => {
    expect(bffUrl('/x')).not.toMatch(/^https?:/)
    expect(bffUrl('/x').startsWith('/api/bff')).toBe(true)
  })
})
