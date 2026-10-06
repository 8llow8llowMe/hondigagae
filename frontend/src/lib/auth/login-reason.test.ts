import { describe, expect, it } from 'vitest'

import { loginPurposeFor } from '@/lib/auth/login-reason'
import { messages } from '@/lib/messages'

/*
  **로그인을 요구하는 이유를 돌아갈 곳으로 말한다** (#1157). 홈의 `AI로 일정 짜기` 를 누른
  비로그인 사용자가 아무 설명 없이 로그인 폼을 마주했다 (2026-10-06 사용성 점검).
*/
describe('loginPurposeFor — 무엇을 하려고 왔는가 (#1157)', () => {
  it.each([
    ['/ai-plans/new', messages.auth.purposeAiPlan],
    ['/plans', messages.auth.purposePlan],
    ['/plans/223456789012000005', messages.auth.purposePlan],
    ['/pets/new?returnTo=%2Fai-plans%2Fnew', messages.auth.purposePet],
    ['/favorites', messages.auth.purposeFavorite],
    ['/mypage/password', messages.auth.purposeMypage],
  ])('%s → 그 화면의 목적', (returnTo, purpose) => {
    expect(loginPurposeFor(returnTo)).toBe(purpose)
  })

  it('보호 경로가 아닌 곳에서 왔으면 일반 문구다 — 예) 장소 상세의 일정에 담기', () => {
    expect(loginPurposeFor('/places/212481712381923328')).toBe(messages.auth.purposeGeneric)
  })

  it('홈이면 말하지 않는다 — 사용자가 스스로 로그인을 눌렀다', () => {
    expect(loginPurposeFor('/')).toBeNull()
  })

  /* 접두어만 보면 `/plans` 가 `/plansx` 에도, `/pets` 가 `/petshop` 에도 걸린다 */
  it('경로 조각 단위로 본다 — 접두어가 같은 다른 경로에 걸리지 않는다', () => {
    expect(loginPurposeFor('/petshop')).toBe(messages.auth.purposeGeneric)
  })
})
