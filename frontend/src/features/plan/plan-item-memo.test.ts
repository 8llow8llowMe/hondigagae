import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanItemMemoText } from '@/features/plan/plan-item-memo'
import { PlanItemRow } from '@/features/plan/plan-item-row'
import { messages } from '@/lib/messages'
import type { PlanItemRowModel } from '@/lib/plan/detail'
import { type PlanItemMemoView, planItemMemoView } from '@/lib/plan/item-memo'
import { planDetail } from '@/test/fixtures/plan'

/**
 * 일정 상세 항목 메모 — 이슈 #1448 · `일정상세-세부명세.md` D29.
 *
 * AI 초안의 항목 설명은 담을 때 `memo` 로 저장되는데(#84 · 공통명세 S11-3) 행이 그것을 그리지
 * 않아 저장 뒤 설명이 "사라진" 것으로 보였다.
 */
const SHORT = '아침 산책으로 바다 감상해요'
const LONG = '그늘이 많아 더위에 약한 아이도 괜찮아요. '.repeat(4).trim()

function renderRow(memo: string | null) {
  const model: PlanItemRowModel = {
    item: { ...planDetail.items[0]!, memo },
    distanceMeters: null,
    distanceKind: null,
  }

  return renderToStaticMarkup(createElement(PlanItemRow, { model }))
}

function renderText(memo: PlanItemMemoView, expanded = false) {
  return renderToStaticMarkup(
    createElement(PlanItemMemoText, { memo, title: '협재해수욕장', expanded, onToggle: () => {} }),
  )
}

describe('PlanItemRow — 항목 메모 (#1448)', () => {
  it('메모가 있으면 행에 보인다', () => {
    expect(renderRow(SHORT)).toContain(SHORT)
  })

  it('제목보다 아래 · 보조 글자 등급이다 — 이름 > 보조 설명', () => {
    const markup = renderRow(SHORT)
    const title = planDetail.items[0]!.title

    expect(markup.indexOf(title)).toBeLessThan(markup.indexOf(SHORT))
    expect(markup).toMatch(new RegExp(`text-body-2 text-fg-muted[^"]*">${SHORT}</p>`))
  })

  it('메모가 없으면 메모 줄도 펴기 버튼도 없다', () => {
    const markup = renderRow(null)

    expect(markup).not.toContain('whitespace-pre-line')
    expect(markup).not.toContain(messages.plan.itemMemoMore)
  })

  it('공백뿐인 메모는 없는 것과 같다', () => {
    expect(renderRow('   ')).not.toContain('whitespace-pre-line')
  })

  it('짧은 메모는 접지 않고 버튼도 없다', () => {
    const markup = renderRow(SHORT)

    expect(markup).not.toContain('line-clamp-2')
    expect(markup).not.toContain('aria-expanded')
  })

  it('긴 메모는 두 줄에서 접고 더 보기를 세운다', () => {
    const markup = renderRow(LONG)

    expect(markup).toContain('line-clamp-2')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain(`>${messages.plan.itemMemoMore}</button>`)
  })
})

describe('PlanItemMemoText', () => {
  it('펼치면 줄 제한을 걷고 접기를 세운다', () => {
    const markup = renderText(planItemMemoView(LONG)!, true)

    expect(markup).not.toContain('line-clamp-2')
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain(`>${messages.plan.itemMemoLess}</button>`)
  })

  it('버튼의 접근 이름이 어느 항목의 메모인지 말한다 — 한 일자에 여럿 선다', () => {
    const markup = renderText(planItemMemoView(LONG)!)

    expect(markup).toContain(
      `aria-label="${messages.plan.itemMemoMoreLabel.replace('{title}', '협재해수욕장')}"`,
    )
  })

  it('버튼이 메모 문단을 가리킨다', () => {
    const markup = renderText(planItemMemoView(LONG)!)
    const id = /<p id="([^"]+)"/.exec(markup)?.[1]

    expect(id).toBeDefined()
    expect(markup).toContain(`aria-controls="${id}"`)
  })

  it('넓은 폭에서 두 줄에 들어오는 길이면 그 폭에서는 접지도 버튼을 세우지도 않는다', () => {
    const markup = renderText({ text: '가'.repeat(40), collapse: 'mobile' })

    expect(markup).toContain('md:line-clamp-none')
    expect(markup).toContain('md:hidden')
  })

  it('어디서나 접는 길이면 넓은 폭에서도 버튼이 남는다', () => {
    const markup = renderText({ text: '가'.repeat(80), collapse: 'all' })

    expect(markup).not.toContain('md:line-clamp-none')
    expect(markup).not.toContain('md:hidden')
  })
})
