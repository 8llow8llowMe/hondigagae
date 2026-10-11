import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { addPlaceConfirmNotice, addPlaceConfirmReason } from '@/lib/plan/add-place-confirm'
import { placeSummary } from '@/test/fixtures/place'
import type { PlaceSummary } from '@/types/place'

/** 장소 담기의 한 번 더 확인 — 이슈 #1383 · 일정상세-세부명세 D24-4 */
function withAllowance(code: string): PlaceSummary {
  return { ...placeSummary, petAllowanceType: { code, name: code, description: null } }
}

describe('addPlaceConfirmReason', () => {
  it('동반 불가 · 미확인은 확인을 받는다', () => {
    expect(addPlaceConfirmReason(withAllowance('NOT_ALLOWED'))).toBe('NOT_ALLOWED')
    expect(addPlaceConfirmReason(withAllowance('UNKNOWN'))).toBe('UNKNOWN')
  })

  it('동반 가능 · 일부 가능은 바로 담는다', () => {
    expect(addPlaceConfirmReason(withAllowance('ALLOWED'))).toBeNull()
    expect(addPlaceConfirmReason(withAllowance('PARTIALLY_ALLOWED'))).toBeNull()
  })

  it('모르는 코드는 미확인으로 본다 — 확인 없이 담기는 쪽으로 새지 않는다', () => {
    expect(addPlaceConfirmReason(withAllowance('SOMETHING_NEW'))).toBe('UNKNOWN')
  })
})

describe('addPlaceConfirmNotice', () => {
  it('사유마다 다른 문장이다', () => {
    expect(addPlaceConfirmNotice('NOT_ALLOWED')).toBe(messages.plan.addPlaceConfirmNotAllowed)
    expect(addPlaceConfirmNotice('UNKNOWN')).toBe(messages.plan.addPlaceConfirmUnknown)
  })
})
