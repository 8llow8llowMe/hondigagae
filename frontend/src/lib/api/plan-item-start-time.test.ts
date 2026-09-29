import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Client from '@/lib/api/client'
import { changeItemStartTime } from '@/lib/api/plan'

const clientFetchVoid = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof Client>()),
  clientFetchVoid,
}))

beforeEach(() => clientFetchVoid.mockClear())

/*
  항목 시간 저장은 **단건 API** 다 (#1053). 일자 일괄 교체(`PUT …/days/{day}/items`)로 되돌아가면
  그날의 방문 체크가 전부 풀리고 `planItemId` 가 새로 발급된다 — mock 테스트는 mock 의 보존만
  잠그고, 화면이 이 경로를 실제로 부르는지는 여기서 잠근다.
*/
describe('changeItemStartTime (#1053)', () => {
  it('항목 하나의 start-time 하위 리소스에 PUT 한다', async () => {
    await changeItemStartTime('223456789012000001', '323456789012000007', '10:30:00')

    expect(clientFetchVoid).toHaveBeenCalledWith(
      '/plans/223456789012000001/items/323456789012000007/start-time',
      { method: 'PUT', body: { startTime: '10:30:00' } },
    )
  })

  it('비우기는 본문에 null 을 명시한다 — 바디가 없으면 서버가 400 이다', async () => {
    await changeItemStartTime('223456789012000001', '323456789012000007', null)

    expect(clientFetchVoid).toHaveBeenCalledWith(expect.stringContaining('/start-time'), {
      method: 'PUT',
      body: { startTime: null },
    })
  })
})

/*
  훅은 node 환경에서 렌더할 수 없어(이 저장소에 훅 테스트 관례가 없다) 소스로 잠근다 — 저장이
  일괄 교체로 되돌아가면 방문 체크 초기화가 되살아난다.
*/
describe('usePlanItemTime 의 저장 경로 (#1053)', () => {
  it('단건 API 를 부르고 일자 일괄 교체를 부르지 않는다', () => {
    const hook = readFileSync('src/features/plan/use-plan-item-time.ts', 'utf8')

    expect(hook).toContain('changeItemStartTime(')
    expect(hook).not.toContain('replaceDayItems')
  })
})
