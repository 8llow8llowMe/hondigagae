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

  it('끝이 없고 커서도 시작일에 있으면 칠할 구간이 없다', () => {
    const markup = render({ value: '2026-09-10', rangeStart: '2026-09-10', rangeEnd: '' })

    // hover 클래스의 bg-band 는 남으므로 요일 머리글이 아닌 칸에 띠가 없는 것만 본다
    expect(markup).not.toContain('bg-band text-fg font-medium')
  })
})

describe('Calendar — 끝을 고르는 중의 미리보기', () => {
  /*
    종료일 달력은 시작일만 들고 열린다. 어디까지 고르는 중인지 보이지 않으면 며칠 일정이
    되는지 손을 떼기 전까지 알 수 없다. 커서가 없을 때는 **포커스 칸**이 끝을 대신하므로
    방향키 사용자에게도 같은 띠가 보인다 — 그래서 이 동작이 마크업으로 검증된다.
  */
  it('끝이 비어 있으면 시작일부터 포커스 칸까지 칠한다', () => {
    // 포커스는 오늘(9/2)이고 시작일이 8/30 이라 그 사이가 구간이다
    const markup = render({ value: '', rangeStart: '2026-08-30', rangeEnd: '' })

    expect(markup).toContain('bg-band')
  })

  it('포커스가 시작일보다 앞이면 칠하지 않는다 — 거꾸로 된 구간은 구간이 아니다', () => {
    const markup = render({ value: '', rangeStart: '2026-09-20', rangeEnd: '' })

    expect(markup).not.toContain('bg-band text-fg font-medium')
  })

  it('다른 필드가 정한 시작일은 회색으로 세운다 — 이 달력의 값이 아니다', () => {
    const markup = render({ value: '', rangeStart: '2026-08-30', rangeEnd: '' })

    expect(markup).toContain('bg-border-strong')
    /*
      브랜드 채움은 **이 달력에서 고른 값**에만 쓴다. `bg-brand-600` 만 보면 안 된다 —
      오늘 표시 점도 같은 색이라 항상 걸린다. 선택 칸의 조합으로 좁힌다.
    */
    expect(markup).not.toContain('bg-brand-600 text-fg-inverse')
  })

  it('값이 없고 min 이 뒤에 있으면 그 달에서 연다 — 오늘의 달은 전부 잠겨 있다', () => {
    const markup = render({ value: '', min: '2026-12-24' })

    expect(markup).toContain('2026년 12월')
    expect(markup).not.toContain('2026년 9월')
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
