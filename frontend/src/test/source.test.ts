/**
 * 소스 단언 헬퍼 자신의 계약 — 이슈 #458.
 *
 * **헬퍼가 틀리면 그것을 쓰는 아홉 파일이 조용히 틀린다.** 특히 주석을 너무 많이 걷으면
 * 계약 단언이 헛되이 실패하고, 너무 적게 걷으면 주석에 속아 통과한다 — 양쪽 다 여기서 본다.
 */
import { describe, expect, it } from 'vitest'

import { openingTags, readSource, readSourceWithoutComments, stripComments } from '@/test/source'

describe('stripComments', () => {
  it('블록 주석을 걷는다 — 여러 줄도', () => {
    expect(stripComments('const a = 1 /* 설명 */\n/*\n  여러 줄\n*/\nconst b = 2')).not.toContain(
      '설명',
    )
    expect(stripComments('/*\n  여러 줄\n*/\nconst b = 2')).toContain('const b = 2')
  })

  it('줄 첫머리의 줄 주석을 걷는다', () => {
    expect(stripComments('  // 근거를 적는다\nconst a = 1')).not.toContain('근거를 적는다')
  })

  /*
    **이 이슈가 명시적으로 요구한 것이다.** `^\s*\/\/` 가 아니라 `\/\/` 로 두면
    `https://` 가 든 줄이 URL 앞에서 잘린다 — 목 fixture 와 `next.config.ts` 가 그런
    문자열을 여럿 갖고 있다.
  */
  it('줄 가운데의 // 는 그대로 둔다 — URL 을 자르지 않는다', () => {
    const source = "const url = 'https://tong.visitkorea.or.kr/photo.jpg'"

    expect(stripComments(source)).toBe(source)
  })

  it('주석 안의 클래스명이 단언에 걸리지 않는다 — 이 헬퍼가 존재하는 이유', () => {
    const source = `/* 예전에는 md:px-10 이었다 */\n<State inset="card" />`

    expect(stripComments(source)).not.toContain('md:px-10')
    expect(stripComments(source)).toContain('inset="card"')
  })
})

describe('readSource · readSourceWithoutComments', () => {
  it('저장소 루트 기준 경로를 읽는다', () => {
    expect(readSource('package.json')).toContain('"name": "hondigagae-frontend"')
  })

  it('주석을 걷은 사본을 준다 — 코드는 남는다', () => {
    const raw = readSource('src/components/surface.tsx')
    const stripped = readSourceWithoutComments('src/components/surface.tsx')

    // `Canvas` 주석이 `flex-1` 을 근거로 인용한다 — 코드 쪽 한 곳만 남아야 한다
    expect(raw.split('flex-1').length).toBeGreaterThan(stripped.split('flex-1').length)
    expect(stripped).toContain('export function Canvas')
  })
})

describe('openingTags', () => {
  it('여러 줄 태그를 통째로 집는다', () => {
    const source = '<Foo\n  a="1"\n  b={2}\n/>'

    expect(openingTags(source, /<Foo\b/g)).toEqual([source])
  })

  /*
    **정규식을 걷어낸 이유다.** `/<Foo\b[\s\S]*?\/>/` 는 `action={<Bar />}` 의 안쪽 `/>`
    에서 멈춰 뒤쪽 prop 을 통째로 잃는다. 저장소에 실재하는 모양이다
    (`action={<PlaceBackLink />}`).
  */
  it('prop 안의 self-closing 자식에서 잘리지 않는다', () => {
    const source = '<Foo\n  action={<Bar />}\n  inset="card"\n/>'

    expect(openingTags(source, /<Foo\b/g)[0]).toContain('inset="card"')
  })

  it('자식을 가진 태그는 여는 태그에서 멈춘다', () => {
    const source = '<Foo a="1">\n  <Child />\n</Foo>'

    expect(openingTags(source, /<Foo\b/g)).toEqual(['<Foo a="1">'])
  })

  it('문자열 안의 중괄호·꺾쇠를 세지 않는다', () => {
    const source = `<Foo\n  title="a > b {c}"\n  inset="card"\n/>`

    expect(openingTags(source, /<Foo\b/g)[0]).toContain('inset="card"')
  })

  it('태그가 여럿이면 각각 집는다', () => {
    const source = '<Foo a="1" />\n<Foo a="2" />'

    expect(openingTags(source, /<Foo\b/g)).toHaveLength(2)
  })

  it('접두사가 같은 다른 태그를 물지 않는다 — \\b 가 경계를 준다', () => {
    const source = '<Surface title="x">\n<SurfaceStack className="y">'

    expect(openingTags(source, /<Surface\b/g)).toEqual(['<Surface title="x">'])
  })
})
