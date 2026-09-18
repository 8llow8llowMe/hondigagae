import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { petEditPageTitle } from '@/lib/pet/detail-title'

/**
 * **#676.** `[petId]/not-found.tsx` 자체의 `metadata` 가 Next 16 에서 먹히지 않아
 * (`detail-title.ts` 머리주석), `generateMetadata` 가 이 판정을 대신 쓴다.
 */
describe('petEditPageTitle', () => {
  it('404 는 반려견 상세 404 문구를 돌려준다', () => {
    const title = petEditPageTitle(new ApiError(404, 'PET_001', '존재하지 않는 반려견입니다.'))

    expect(title).toBe(messages.pet.notFoundTitle)
  })

  it('성공(에러 없음)은 편집 화면 제목이다', () => {
    expect(petEditPageTitle(null)).toBe(messages.pet.editTitle)
  })

  it('5xx·무응답·400 은 기존과 같은 편집 화면 제목이다 — 새 갈래를 만들지 않는다', () => {
    for (const error of [
      new ApiError(503, null, null),
      new ApiError(0, null, null),
      new ApiError(400, 'PET_113', null),
    ]) {
      expect(petEditPageTitle(error)).toBe(messages.pet.editTitle)
    }
  })

  it('ApiError 가 아니면 편집 화면 제목으로 떨어진다', () => {
    expect(petEditPageTitle(new TypeError('boom'))).toBe(messages.pet.editTitle)
  })
})
