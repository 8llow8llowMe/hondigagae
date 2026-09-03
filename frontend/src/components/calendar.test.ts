import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Calendar, dayLabel } from '@/components/calendar'

function render(props: Partial<Parameters<typeof Calendar>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(Calendar, {
      value: '',
      today: '2026-09-02',
      onSelect: () => undefined,
      ...props,
    }),
  )
}

describe('dayLabel', () => {
  it('숫자만 읽히지 않게 날짜 전체를 이름으로 만든다', () => {
    expect(dayLabel('2026-09-12')).toBe('2026년 9월 12일 (토)')
    expect(dayLabel('2026-09-01')).toBe('2026년 9월 1일 (화)')
  })
})

describe('Calendar', () => {
  it('선택값이 없으면 오늘의 달을 그린다', () => {
    expect(render()).toContain('2026년 9월')
  })

  it('선택값의 달을 그린다 — 오늘의 달이 아니다', () => {
    const markup = render({ value: '2027-03-15' })

    expect(markup).toContain('2027년 3월')
    expect(markup).not.toContain('2026년 9월')
  })

  it('42칸을 그린다 — 6주 고정이다', () => {
    const markup = render()

    expect(markup.match(/aria-label="\d{4}년 \d{1,2}월 \d{1,2}일/g)).toHaveLength(42)
  })

  it('오늘에 aria-current="date" 를 붙인다', () => {
    const markup = render()

    expect(markup.match(/aria-current="date"/g)).toHaveLength(1)
    expect(markup).toContain(
      'aria-label="2026년 9월 2일 (수)" aria-pressed="false" aria-current="date"',
    )
  })

  it('선택된 칸만 aria-pressed 다', () => {
    const markup = render({ value: '2026-09-12' })

    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).toContain('aria-label="2026년 9월 12일 (토)" aria-pressed="true"')
  })

  it('min 보다 이른 칸을 잠근다', () => {
    const markup = render({ value: '2026-09-12', min: '2026-09-10' })
    const locked = markup.match(/disabled=""/g)

    // 8월 채움칸 2 + 9월 1~9 = 11칸
    expect(locked).toHaveLength(11)
  })

  it('격자 전체가 탭 정지 하나다 — 42칸을 탭으로 지나가게 두지 않는다', () => {
    const markup = render({ value: '2026-09-12' })

    expect(markup.match(/tabindex="0"/g)).toHaveLength(1)
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(41)
  })

  it('선택값이 없으면 오늘이 탭 정지다 — 격자에 들어갈 문이 있어야 한다', () => {
    const markup = render()

    expect(markup).toContain('data-focused="true" aria-label="2026년 9월 2일 (수)"')
  })

  it('기간을 띠로 남긴다 — 시작일 달력에서도 며칠인지 보인다', () => {
    const markup = render({ value: '2026-09-10', rangeStart: '2026-09-10', rangeEnd: '2026-09-12' })
    // 선택 칸은 채움이 이기고, 나머지 기간(11·12)만 띠다
    const band = markup.match(/bg-band/g)

    expect(band).not.toBeNull()
    expect(markup).toContain('2026년 9월 11일')
  })

  it('기간이 한쪽만 있으면 띠를 그리지 않는다 — 열린 구간을 색으로 말할 수 없다', () => {
    const markup = render({ value: '2026-09-10', rangeStart: '2026-09-10', rangeEnd: '' })

    // hover 클래스의 bg-band 는 남으므로 요일 머리글이 아닌 칸에 띠가 없는 것만 본다
    expect(markup).not.toContain('bg-band text-fg font-medium')
  })
})

describe('Calendar — 달·해 이동 (#162)', () => {
  /*
    달 버튼만 있으면 내년 여행을 잡는 데 12번을 눌러야 한다. 연 이동은 `shiftMonth` 에
    12를 넘기는 것이라 날짜 계산 코드가 늘지 않는다.
  */
  it('연 단위 이동 버튼이 함께 있다', () => {
    const markup = render()

    expect(markup).toContain('이전 해')
    expect(markup).toContain('다음 해')
  })

  it('달 이동은 그대로 있다 — 연 이동이 대체가 아니다', () => {
    const markup = render()

    expect(markup).toContain('이전 달')
    expect(markup).toContain('다음 달')
  })

  /*
    아이콘 자체는 뜻을 지지 않는다 — 겹친 화살표가 "한 번에 더 멀리" 로 읽히려면 접근
    가능한 이름이 실제 의미를 말해야 한다. 이름이 없으면 화살표 넷이 구분되지 않는다.
  */
  it('네 버튼이 모두 이름을 갖는다', () => {
    const labels = ['이전 해', '이전 달', '다음 달', '다음 해']
    const markup = render()

    for (const label of labels) {
      expect(markup).toContain(`aria-label="${label}"`)
    }
  })
})
