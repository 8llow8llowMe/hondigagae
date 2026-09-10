import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  Band,
  Canvas,
  Row,
  RowList,
  Section,
  Surface,
  SurfaceList,
  SurfaceStack,
} from '@/components/surface'

/**
 * 표면 프리미티브 — 이슈 #422 · #428 · #435.
 *
 * **이 파일의 절반은 3a 가 2a 를 건드리지 않는다는 것을 지킨다.** §0 은 3a 로 개정됐지만
 * (#435) 2a 프리미티브는 아직 홈 외 화면이 쓰고 있어, 그 화면들은 옮겨질 때까지 시각적으로
 * 무변화여야 한다. 계약이 깨지는 가장 흔한 경로가 "새 프리미티브를 만들면서 옆에 있는 옛
 * 것을 조금 고치는" 것이다.
 */

/**
 * 클래스를 토큰으로 쪼갠다.
 *
 * **`toContain` 으로 클래스를 보면 안 된다** — `border-border`(색 토큰)가 `border-b` 와
 * `border` 를 부분 문자열로 품어 둘 다 오탐한다. 실제로 이 파일에서 두 번 걸렸다.
 */
function classesOf(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? '').split(/\s+/).filter((name) => name !== ''),
  )
}

describe('2a 표면 — 3a 가 추가돼도 그대로다 (이슈 #422 무변화 계약)', () => {
  it('Section 은 여전히 radius·border 가 없다 — 카드가 되면 전 화면이 함께 바뀐다', () => {
    const markup = renderToStaticMarkup(
      createElement(Section, {
        title: '오늘 갈 만한 곳',
        children: createElement('p', null, '본문'),
      }),
    )

    const classes = classesOf(markup)
    expect(classes.filter((name) => name.startsWith('rounded'))).toEqual([])
    expect(classes.filter((name) => name.startsWith('border'))).toEqual([])
    expect(markup).toContain('오늘 갈 만한 곳')
  })

  it('Section 의 좌우 인셋은 16/40 그대로다 — Row 의 구분선과 같은 축이어야 한다', () => {
    const markup = renderToStaticMarkup(
      createElement(Section, { title: '제목', children: createElement('p', null, '본문') }),
    )

    expect(markup).toContain('px-4')
    expect(markup).toContain('md:px-10')
  })

  it('Row 는 구분선을 여전히 border-bottom 으로 긋는다', () => {
    const markup = renderToStaticMarkup(createElement(Row, null, '행'))

    const classes = classesOf(markup)
    expect(classes).toContain('border-b')
    expect(classes).not.toContain('border-t')
  })

  it('Band 는 8px 회색 띠 그대로다', () => {
    expect(renderToStaticMarkup(createElement(Band))).toContain('bg-band h-2 w-full')
  })

  it('RowList 는 흰 배경을 스스로 칠한다 — 전폭 행이라 감싸는 카드가 없다', () => {
    expect(renderToStaticMarkup(createElement(RowList, null, '목록'))).toContain('bg-bg')
  })
})

describe('L0 Canvas — 페이지 바닥', () => {
  it('--bg-sunken 을 바닥으로 깐다 — 흰색은 바닥이 아니라 Surface 의 색이다', () => {
    expect(renderToStaticMarkup(createElement(Canvas, null, '내용'))).toContain('bg-bg-sunken')
  })

  it('바닥만 칠하고 배치는 하지 않는다 — 전폭이어야 하기 때문이다', () => {
    const classes = classesOf(renderToStaticMarkup(createElement(Canvas, null, '내용')))

    /*
      **여백·간격이 여기 붙으면 안 된다.** 붙는 순간 이 요소가 콘텐츠 컨테이너가 되고,
      `.rail-layout`(최대 1440) 바깥이 흰색으로 남는다 — 1800 실측에서 좌우 177px 이
      그렇게 비었다. 배치는 `SurfaceStack` 이 맡는다.
    */
    expect(classes.filter((name) => /(^|:)(p|px|py|gap)-/.test(name))).toEqual([])
    expect(classes).toEqual(['bg-bg-sunken'])
  })

  it('main 으로 낼 수 있다 — 바닥을 그리려고 래퍼를 하나 더 두지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Canvas, { as: 'main', id: 'main-content', children: '내용' }),
    )

    expect(markup).toContain('<main')
    expect(markup).toContain('id="main-content"')
  })
})

describe('SurfaceStack — L0 위에 카드를 쌓는 열', () => {
  it('모바일은 좌우 여백이 없다 — Surface 가 전폭으로 내려앉기 때문이다', () => {
    const classes = classesOf(renderToStaticMarkup(createElement(SurfaceStack, null, '내용')))

    // 데스크톱에서만 패딩이 붙는다. 무조건부 p-* 가 있으면 모바일 전폭이 깨진다
    expect(classes).toContain('md:p-6')
    expect(classes.filter((name) => /^p-\d/.test(name))).toEqual([])
  })

  it('모바일 세로 간격이 8px 이다 — 바닥이 비쳐 2a 의 Band 와 같은 값이 된다', () => {
    expect(classesOf(renderToStaticMarkup(createElement(SurfaceStack, null, '내용')))).toContain(
      'gap-2',
    )
  })

  it('바닥을 칠하지 않는다 — Canvas 가 이미 화면 끝까지 칠했다', () => {
    const classes = classesOf(renderToStaticMarkup(createElement(SurfaceStack, null, '내용')))

    expect(classes.filter((name) => name.startsWith('bg-'))).toEqual([])
  })
})

describe('L1 Surface — 섹션', () => {
  function render(props: Record<string, unknown> = {}) {
    return renderToStaticMarkup(
      createElement(Surface, {
        title: '오늘 갈 만한 곳',
        children: createElement('p', null, '본문'),
        ...props,
      }),
    )
  }

  it('그림자를 주지 않는다 — 섹션은 페이지 위에 눕지 뜨지 않는다 (DESIGN.md §6)', () => {
    expect(render()).not.toContain('shadow')
  })

  it('radius 는 12(rounded-lg)다 — 16 은 모달·바텀시트·지도 패널이 쓰는 값이다', () => {
    const markup = render()

    const classes = classesOf(markup)
    expect(classes).toContain('md:rounded-lg')
    expect(classes.filter((name) => name.endsWith('rounded-xl'))).toEqual([])
  })

  it('모바일은 전폭이다 — radius 와 좌우 테두리를 걷고 상하만 남긴다', () => {
    const markup = render()

    // 무조건부 rounded 가 있으면 390px 에서 카드가 되어 내용 폭 8.9% 를 잃는다
    const classes = classesOf(markup)
    expect(classes).not.toContain('rounded-lg')
    expect(classes).toContain('border-y')
    expect(classes).toContain('md:border')
  })

  it('제목을 카드 안에 넣는다 — 밖에 두면 어느 묶음의 제목인지 모호해진다', () => {
    expect(render()).toContain('<h2')
  })

  it('제목이 없으면 제목 줄 자체를 만들지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Surface, { children: createElement('p', null, '본문') }),
    )

    expect(markup).not.toContain('<h2')
    expect(markup).toContain('본문')
  })

  it('trailing 은 제목 줄 오른쪽에 선다', () => {
    expect(render({ trailing: createElement('a', { href: '/places' }, '전체 보기') })).toContain(
      '전체 보기',
    )
  })
})

describe('L2 SurfaceList — 카드 안 목록', () => {
  function render(count = 3) {
    return renderToStaticMarkup(
      createElement(
        SurfaceList,
        null,
        Array.from({ length: count }, (_, index) =>
          createElement('li', { key: index }, `행 ${index}`),
        ),
      ),
    )
  }

  it('구분선 규약을 항목이 아니라 목록이 갖는다', () => {
    /*
      2a 의 `Row` 는 `border-bottom` 을 행에 걸고 마지막 행이 `last` 로 껐다 — 그래서
      **행 수를 아는 호출자만 목록을 그릴 수 있었고**, 홈에서 규약이 세 갈래로 갈렸다.

      **임의 variant 는 마크업에서 이스케이프된 형태로 나온다.** React 가 속성값의
      `&` 와 `>` 를 실체참조로 바꾸므로 `[&>li+li]:` 가 `[&amp;&gt;li+li]:` 가 된다 —
      소스에 적은 문자열로 단언하면 통과하지 않는다 (여기서 실제로 걸렸다).
    */
    const classes = classesOf(render())

    expect(classes).toContain('[&amp;&gt;li+li]:border-t')
    expect(classes).toContain('[&amp;&gt;li+li]:border-border')
  })

  it('첫 항목 위에는 선을 긋지 않는다 — 제목 아래 선은 카드의 몫이다', () => {
    /*
      `li+li` 는 인접 형제 결합자라 첫 항목에 걸리지 않는다. 무조건부 `border-t` 를
      쓰면 제목이 없는 카드에서 허공에 선이 뜬다.
    */
    const classes = classesOf(render())

    expect(classes.filter((name) => name === 'border-t')).toEqual([])
  })

  it('ul 로 내보낸다 — 스크린리더가 개수를 읽어야 한다', () => {
    expect(render()).toContain('<ul')
  })

  it('좌우 인셋을 갖지 않는다 — 항목마다 세로 여백이 달라 항목이 정한다', () => {
    const classes = classesOf(render())

    expect(classes.filter((name) => /(^|:)(px|py|p|gap)-/.test(name))).toEqual([])
  })

  it('바닥을 칠하지 않는다 — 면은 Surface 가 소유한다 (§0)', () => {
    const classes = classesOf(render())

    expect(classes.filter((name) => name.startsWith('bg-'))).toEqual([])
  })

  it('aria-busy 를 전달한다 — 재조회 중 목록을 흐리게만 두는 갈래가 쓴다', () => {
    expect(
      renderToStaticMarkup(
        createElement(SurfaceList, {
          'aria-busy': true,
          children: createElement('li', null, '행'),
        }),
      ),
    ).toContain('aria-busy="true"')
  })
})
