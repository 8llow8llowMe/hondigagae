import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * 두 일정 만들기 화면이 **같은 순서로 묻는지** — 이슈 #400.
 *
 * `/plans/new` 와 `/ai-plans/new` 는 같은 일(여행 일정 만들기)을 하는 두 갈래인데 묻는
 * 순서가 어긋나 있었다 — `반려견 → 제목 → 기간` 대 `기간 → 반려견` 으로 **반려견과 기간이
 * 서로 뒤집혀** 있어, 한쪽을 써 본 사람이 다른 쪽에서 다시 헤맸다.
 *
 * **이 검사가 없어서 갈라졌다.** 두 폼은 다른 파일이고 각자의 테스트는 자기 필드만 보므로,
 * 한쪽에 필드를 끼워 넣는 변경이 다른 쪽과의 순서를 깨도 아무것도 실패하지 않는다.
 *
 * **렌더 결과가 아니라 소스의 등장 순서를 본다.** 두 폼은 값·오류·반려견 목록을 prop 으로
 * 받는 표시 컴포넌트지만 `AiPlanCreateForm` 은 접기 안에 필드를 감추므로(#354) 렌더
 * 마크업에서의 순서가 화면의 묻는 순서와 다르다. 지키려는 것은 **작성 순서**다.
 */

function repoSource(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8')
}

/** `id="..."` 가 소스에 처음 나오는 자리 */
function firstIndexOfField(source: string, id: string): number {
  return source.indexOf(`id="${id}"`)
}

/** 주어진 필드들이 소스에 나온 순서 */
function orderOf(source: string, ids: string[]): string[] {
  return [...ids]
    .filter((id) => firstIndexOfField(source, id) >= 0)
    .sort((a, b) => firstIndexOfField(source, a) - firstIndexOfField(source, b))
}

const planForm = repoSource('src/features/plan/plan-create-form.tsx')
const aiForm = repoSource('src/features/ai-plan/ai-plan-create-form.tsx')

describe('일정 만들기 두 화면의 묻는 순서 (#400)', () => {
  /*
    **기간이 먼저인 쪽으로 맞췄다.** 여행 계획은 "언제 가지" → "누구랑" 순서이고,
    시작일을 고르면 종료일 달력이 이어서 열리는 흐름이 기간이 첫 블록일 때 가장 자연스럽다.
  */
  it('두 화면 모두 기간을 반려견보다 먼저 묻는다', () => {
    for (const [name, source, petField] of [
      ['plan', planForm, 'petId'],
      ['ai-plan', aiForm, 'petIds'],
    ] as const) {
      const start = firstIndexOfField(source, 'startDate')
      const end = firstIndexOfField(source, 'endDate')
      const pet = firstIndexOfField(source, petField)

      expect(start, `${name}: startDate 가 있어야 한다`).toBeGreaterThanOrEqual(0)
      expect(pet, `${name}: ${petField} 가 있어야 한다`).toBeGreaterThanOrEqual(0)
      expect(start, `${name}: 시작일이 종료일보다 먼저다`).toBeLessThan(end)
      expect(end, `${name}: 기간이 반려견보다 먼저다`).toBeLessThan(pet)
    }
  })

  it('/plans/new 은 기간 → 반려견 → 제목 → 예산 순이다', () => {
    expect(orderOf(planForm, ['budget', 'petId', 'startDate', 'title', 'endDate'])).toEqual([
      'startDate',
      'endDate',
      'petId',
      'title',
      'budget',
    ])
  })

  /*
    AI 쪽은 반려견 뒤에 자유 요청이 온다 — `/plans/new` 의 `제목` 과 같은 자리(기간·반려견
    뒤의 텍스트 입력)다. 그 뒤는 접기(`AiPlanDetailsDisclosure`)라 선택 입력이 전부 뒤로 간다.
  */
  it('/ai-plans/new 은 기간 → 반려견 → 자유 요청 순이다', () => {
    expect(orderOf(aiForm, ['requestNote', 'petIds', 'endDate', 'startDate'])).toEqual([
      'startDate',
      'endDate',
      'petIds',
      'requestNote',
    ])
  })

  /*
    **선택 입력은 필수 뒤다.** AI 쪽은 접기로, `/plans/new` 은 자리로 그것을 말한다 —
    선택 입력이 하나(`예산`)뿐이라 접기를 두면 여는 동작이 그 하나보다 비싸다 (#400).
  */
  it('/plans/new 의 선택 입력(예산)이 모든 필수 뒤에 온다', () => {
    const budget = firstIndexOfField(planForm, 'budget')

    for (const required of ['startDate', 'endDate', 'petId', 'title']) {
      expect(firstIndexOfField(planForm, required)).toBeLessThan(budget)
    }
  })

  /* 저쪽은 접기가 그 일을 한다 — 접기 컴포넌트가 예산보다 먼저 나와야 예산이 그 안이다 */
  it('/ai-plans/new 의 예산은 접기 안이다', () => {
    const disclosure = aiForm.indexOf('<AiPlanDetailsDisclosure')
    const budget = firstIndexOfField(aiForm, 'budgetManwon')

    expect(disclosure).toBeGreaterThanOrEqual(0)
    expect(disclosure).toBeLessThan(budget)
  })
})
