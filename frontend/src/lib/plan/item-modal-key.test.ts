import { describe, expect, it } from 'vitest'

import { memoModalKey, timeModalKey } from '@/lib/plan/item-modal-key'

/*
  시각 모달과 메모 모달은 일정 상세에서 형제라 key 가 겹치면 React 가 둘을 가르지 못한다 (#1485).
  둘 다 닫힌 평소 상태에서 `'closed'` 로 같았고, 같은 항목을 가리키면 `planItemId` 로 같았다.
*/
describe('일정 상세 항목 모달 key (#1485)', () => {
  it('둘 다 닫혀 있어도 겹치지 않는다', () => {
    expect(timeModalKey(undefined)).not.toBe(memoModalKey(null))
  })

  it('같은 항목을 가리켜도 겹치지 않는다', () => {
    expect(timeModalKey('223456789012000101')).not.toBe(memoModalKey('223456789012000101'))
  })

  it('여는 항목이 바뀌면 key 가 바뀐다 — 새로 마운트해 입력이 그 항목 값에서 시작한다', () => {
    expect(timeModalKey('a')).not.toBe(timeModalKey('b'))
    expect(memoModalKey('a')).not.toBe(memoModalKey('b'))
    expect(timeModalKey('a')).not.toBe(timeModalKey(undefined))
  })
})
