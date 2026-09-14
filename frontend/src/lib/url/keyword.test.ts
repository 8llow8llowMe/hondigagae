import { describe, expect, it } from 'vitest'

import { KEYWORD_MAX_LENGTH, normalizeKeyword } from '@/lib/url/keyword'

/**
 * 검색어 정규화 — `/places`(#431)와 병원·약국(#584)이 **같은 규칙**을 쓴다는 것이 이
 * 모듈의 존재 이유라, 규칙 자체를 여기서 한 번 고정한다. 화면별 테스트는 그 위에서
 * "URL 에 실리는가 / 화면이 좁혀지는가" 만 본다.
 */
describe('normalizeKeyword', () => {
  it('앞뒤 공백을 걷는다', () => {
    expect(normalizeKeyword('  성산  ')).toBe('성산')
  })

  it('가운데 공백은 남긴다 — 여러 낱말로 찾는 검색이 있다', () => {
    expect(normalizeKeyword(' 제주 동물병원 ')).toBe('제주 동물병원')
  })

  it('null · 빈 값 · 공백뿐이면 검색어 없음이다', () => {
    expect(normalizeKeyword(null)).toBeNull()
    expect(normalizeKeyword('')).toBeNull()
    expect(normalizeKeyword('   ')).toBeNull()
  })

  /*
    **자르지 않고 버린다.** 잘라 보내면 사용자가 친 것과 다른 말로 찾은 결과가 그의
    검색어인 척 돌아온다 (`normalizeKeyword` 머리주석).
  */
  it('상한까지는 받고 한 글자라도 넘으면 버린다', () => {
    expect(normalizeKeyword('가'.repeat(KEYWORD_MAX_LENGTH))).toBe('가'.repeat(KEYWORD_MAX_LENGTH))
    expect(normalizeKeyword('가'.repeat(KEYWORD_MAX_LENGTH + 1))).toBeNull()
  })

  it('길이는 공백을 걷은 뒤에 잰다', () => {
    expect(normalizeKeyword(`  ${'가'.repeat(KEYWORD_MAX_LENGTH)}  `)).toHaveLength(
      KEYWORD_MAX_LENGTH,
    )
  })
})
