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
  SurfaceBody,
  SurfaceList,
  SurfaceRow,
  SurfaceStack,
  SurfaceTile,
} from '@/components/surface'

/**
 * 표면 프리미티브 — 이슈 #422.
 *
 * **이 파일의 절반은 3a 가 2a 를 건드리지 않았다는 것을 지킨다.** 화면 전환(#428)
 * 전까지 기존 23개 라우트는 시각적으로 무변화여야 하고, 그 계약이 깨지는 가장 흔한
 * 경로가 "새 프리미티브를 만들면서 옆에 있는 옛 것을 조금 고치는" 것이다.
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

describe('L2 SurfaceRow — 카드 안의 행', () => {
  it('테두리를 두르지 않는다 — Surface 의 테두리와 경쟁해 둘 다 죽는다', () => {
    const classes = classesOf(renderToStaticMarkup(createElement(SurfaceRow, null, '행')))

    // 둘레를 그리는 변은 하나도 없다. 위 구분선(border-t)만 남는다
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('border-b')
    expect(classes).not.toContain('border-l')
    expect(classes).not.toContain('border-r')
    expect(classes.filter((name) => name.startsWith('rounded'))).toEqual([])
  })

  it('구분선은 border-top 이고 첫 행에서만 끈다', () => {
    expect(renderToStaticMarkup(createElement(SurfaceRow, null, '행'))).toContain('border-t')
    expect(
      renderToStaticMarkup(createElement(SurfaceRow, { first: true, children: '행' })),
    ).not.toContain('border-t')
  })

  it('interactive 는 hover 채움만 준다 — 높이나 테두리를 바꾸면 목록이 들썩인다', () => {
    const markup = renderToStaticMarkup(
      createElement(SurfaceRow, { interactive: true, children: '행' }),
    )

    const classes = classesOf(markup)
    expect(classes).toContain('hover:bg-band')
    expect(classes.filter((name) => name.startsWith('hover:border'))).toEqual([])
  })

  it('선택된 행은 hover 채움을 겹치지 않는다 — 두 채움이 싸운다', () => {
    const markup = renderToStaticMarkup(
      createElement(SurfaceRow, { interactive: true, selected: true, children: '행' }),
    )

    const classes = classesOf(markup)
    expect(classes).toContain('bg-row-selected')
    expect(classes).not.toContain('hover:bg-band')
  })

  it('li 로 내보낼 수 있다 — 스크린리더가 개수를 읽는다', () => {
    expect(renderToStaticMarkup(createElement(SurfaceRow, { as: 'li', children: '행' }))).toContain(
      '<li',
    )
  })
})

describe('L2 SurfaceTile — 채움 아이템', () => {
  it('radius 8 이다 — 섹션(12)보다 작아야 중첩이 읽힌다', () => {
    expect(renderToStaticMarkup(createElement(SurfaceTile, null, '칸'))).toContain('rounded-md')
  })

  it('평상시엔 --band, 선택 시엔 --metric-high-100 이다', () => {
    expect(renderToStaticMarkup(createElement(SurfaceTile, null, '칸'))).toContain('bg-band')
    expect(
      renderToStaticMarkup(createElement(SurfaceTile, { selected: true, children: '칸' })),
    ).toContain('bg-metric-high-100')
  })

  it('테두리를 두르지 않는다 — 가로로 늘어서므로 채움이 구분을 맡는다', () => {
    const classes = classesOf(renderToStaticMarkup(createElement(SurfaceTile, null, '칸')))
    expect(classes.filter((name) => name.startsWith('border'))).toEqual([])
  })
})

describe('SurfaceList · SurfaceBody', () => {
  it('SurfaceList 는 배경을 칠하지 않는다 — 감싸는 Surface 가 이미 흰색이다', () => {
    const classes = classesOf(renderToStaticMarkup(createElement(SurfaceList, null, '목록')))
    expect(classes.filter((name) => name.startsWith('bg-'))).toEqual([])
  })

  it('SurfaceBody 의 인셋은 16/20 이다 — 2a 의 40 을 쓰면 내용이 두 번 밀린다', () => {
    const markup = renderToStaticMarkup(createElement(SurfaceBody, null, '본문'))

    const classes = classesOf(markup)
    expect(classes).toContain('md:px-5')
    expect(classes).not.toContain('md:px-10')
  })
})
