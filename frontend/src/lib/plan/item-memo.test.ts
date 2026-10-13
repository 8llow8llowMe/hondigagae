import { describe, expect, it } from 'vitest'

import { planItemMemoView } from '@/lib/plan/item-memo'

/**
 * 일정 상세 항목 메모 — 이슈 #1448 · `일정상세-세부명세.md` D29.
 *
 * 높이를 재지 않고 글자 수 · 줄바꿈으로 접을지를 가른다 — 서버 렌더와 클라이언트 렌더가
 * 같은 결론을 내야 `더 보기` 가 뒤늦게 끼어들지 않는다 (`place-overview.tsx` 와 같은 판단).
 */
describe('planItemMemoView', () => {
  it('메모가 없으면 null — 줄 자체가 없다', () => {
    expect(planItemMemoView(null)).toBeNull()
  })

  it('공백뿐인 메모도 null — 빈 줄을 세우지 않는다', () => {
    expect(planItemMemoView('  \n  ')).toBeNull()
  })

  it('앞뒤 공백을 걷는다', () => {
    expect(planItemMemoView('  아침 산책으로 바다 감상해요  ')?.text).toBe(
      '아침 산책으로 바다 감상해요',
    )
  })

  it('짧은 메모는 접지 않는다', () => {
    expect(planItemMemoView('아침 산책으로 바다 감상해요')?.collapse).toBe('none')
  })

  it('모바일에서만 두 줄을 넘길 길이면 모바일에서만 접는다', () => {
    // 40자 — 모바일 한 줄 16자 기준 세 줄, 데스크톱 32자 기준 두 줄
    const memo = '가'.repeat(40)

    expect(planItemMemoView(memo)?.collapse).toBe('mobile')
  })

  it('데스크톱에서도 두 줄을 넘길 길이면 어디서나 접는다', () => {
    expect(planItemMemoView('가'.repeat(80))?.collapse).toBe('all')
  })

  it('줄바꿈도 줄로 센다 — 짧은 문단 셋이면 접는다', () => {
    expect(planItemMemoView('물 챙기기\n배변봉투\n리드줄')?.collapse).toBe('all')
  })

  it('짧은 문단 둘은 접지 않는다', () => {
    expect(planItemMemoView('물 챙기기\n배변봉투')?.collapse).toBe('none')
  })
})
