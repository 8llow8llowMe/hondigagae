import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SharedPlanItemRow } from '@/features/plan/shared-plan-item-row'
import { planItemPlace } from '@/test/fixtures/plan'
import type { SharedPlanItem } from '@/types/plan'

function render(overrides: Partial<SharedPlanItem> = {}) {
  const item: SharedPlanItem = {
    day: 1,
    sequence: 0,
    itemType: { code: 'PLACE', name: '장소', description: null },
    targetId: '212481712381923328',
    title: '협재해수욕장',
    startTime: null,
    place: planItemPlace({ firstImage: null }),
    ...overrides,
  }

  return renderToStaticMarkup(createElement(SharedPlanItemRow, { item }))
}

/*
  **소유자 행과 같은 타일이다** (#1151). 손 복제였던 시절 이 행만 #842 · #856 을 놓쳐
  회색 타일 · 검정 사각 칩이었다 — 같은 일정이 공유 링크에서만 달라 보였다.
*/
describe('SharedPlanItemRow — 썸네일 타일 (#1151)', () => {
  it('사진이 없으면 항목 유형 일러스트다 (#842)', () => {
    const html = render({ itemType: { code: 'MEAL', name: '식사', description: null } })

    expect(html).toContain('/illustrations/place-restaurant.webp')
  })

  it('모르는 유형은 회색 타일이다 — 유형을 지어내지 않는다', () => {
    expect(render({ itemType: { code: 'NEW', name: '새 유형', description: null } })).not.toContain(
      '/illustrations/',
    )
  })

  it('순번 칩이 흰 원형이다 — 검정 사각이 아니다 (#856)', () => {
    const chip = /<span aria-hidden="true" class="([^"]*)">1<\/span>/.exec(render())?.[1] ?? ''

    expect(chip).toContain('bg-bg')
    expect(chip).toContain('rounded-full')
    expect(chip).not.toContain('bg-fg ')
    expect(chip).not.toContain('rounded-sm')
  })
})
