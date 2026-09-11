import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Canvas, Surface, SurfaceList, SurfaceStack } from '@/components/surface'

/**
 * 표면 프리미티브 — 이슈 #422 · #428 · #435 · #475.
 *
 * **2a 무변화 계약이 사라졌다.** 예전에는 이 파일의 절반이 "3a 를 만들면서 옆에 있는 2a 를
 * 조금 고치지 않는다" 를 지켰는데, 로드맵 #455 가 화면을 전부 옮기고 #475 가 `Band` ·
 * `Section` · `Row` · `RowList` 를 지우면서 지킬 대상 자체가 없어졌다. 남은 것은 3a 넷의
 * 계약이다.
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

  describe('columns={2} — xl 부터 2열 (#462)', () => {
    function render2col(count = 4) {
      return renderToStaticMarkup(
        createElement(SurfaceList, {
          columns: 2,
          children: Array.from({ length: count }, (_, index) =>
            createElement('li', { key: index }, `행 ${index}`),
          ),
        }),
      )
    }

    it('기본은 1열이다 — 2열을 요구한 화면만 켠다', () => {
      expect(classesOf(render())).not.toContain('surface-list-2col')
    })

    it('2열 규약을 이름 있는 클래스 하나로 붙인다', () => {
      /*
        `[&>li:nth-child(2)]:` 같은 arbitrary variant 로 쓰지 않는다 — 괄호가 든
        arbitrary 는 eslint `noComplexArbitrary` 가 막고 globals.css 로 보낸다
        (`.overlay-backdrop` 과 같은 경로). 규칙 본문은 `.surface-list-2col` 에 있다.
      */
      const classes = classesOf(render2col())

      expect(classes).toContain('surface-list-2col')
      expect(classes.filter((name) => name.includes('nth-child'))).toEqual([])
    })

    it('1열 구분선 규약을 그대로 갖는다 — 3번째부터는 li+li 가 맞게 당긴다', () => {
      /*
        2열에서 어긋나는 것은 두 군데뿐이다(첫 시각적 행의 오른쪽 칸 위선 · 열 사이
        세로선). 나머지는 1열과 같은 규칙이라 여기서 지우지 않는다.
      */
      expect(classesOf(render2col())).toContain('[&amp;&gt;li+li]:border-t')
    })
  })
})
