import { describe, expect, it } from 'vitest'

import { regionHintFromNote } from '@/lib/ai-plan/region-hint'

/**
 * 메모의 권역 낱말 → 지역 칩 제안 — 이슈 #1381.
 *
 * `SIGUNGU_LABEL`: `'4'` 제주시 · `'3'` 서귀포시.
 */
describe('regionHintFromNote', () => {
  it('서귀포 낱말이면 서귀포시다 — dev 실측 메모', () => {
    expect(regionHintFromNote('서귀포 위주로 이동은 짧게')).toBe('3')
  })

  it('서귀포시 읍면 · 동네 이름도 서귀포시다', () => {
    for (const note of ['중문 쪽 숙소', '성산 일출봉 보고 싶어요', '표선 해변', '모슬포 회']) {
      expect(regionHintFromNote(note)).toBe('3')
    }
  })

  it('제주시 · 그 읍면 이름이면 제주시다', () => {
    for (const note of ['제주시 위주', '애월 카페', '협재 해변 가고 싶어요', '함덕에서 산책']) {
      expect(regionHintFromNote(note)).toBe('4')
    }
  })

  it('제주 만으로는 좁히지 않는다 — 섬 전체다', () => {
    expect(regionHintFromNote('제주 여행 처음이에요')).toBeNull()
    expect(regionHintFromNote('제주도 동쪽')).toBeNull()
  })

  it('두 권역이 다 나오면 제안하지 않는다', () => {
    expect(regionHintFromNote('애월에서 시작해 중문까지')).toBeNull()
  })

  it('다른 낱말 속 글자에 걸리지 않는다 (리뷰에서 실측한 오탐)', () => {
    for (const note of [
      '사계절 내내 걷기 좋은 곳',
      '아이 체력을 키우도록 많이 걷고 싶어요',
      '10월정도라 쌀쌀할 것 같아요',
      '이동이 편한경로로',
    ]) {
      expect(regionHintFromNote(note)).toBeNull()
    }
  })

  it('앞뒤를 보는 이름도 제 뜻으로 쓰면 잡는다', () => {
    expect(regionHintFromNote('우도 들어가는 배')).toBe('4')
    expect(regionHintFromNote('월정리 해변 카페')).toBe('4')
  })

  it('권역 낱말이 없으면 제안하지 않는다', () => {
    expect(regionHintFromNote('')).toBeNull()
    expect(regionHintFromNote('실내 위주로 천천히')).toBeNull()
  })
})
