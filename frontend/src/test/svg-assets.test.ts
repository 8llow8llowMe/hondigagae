import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `public/illustrations/*.svg` 가 **XML 로 읽히는지** 잠근다 (#845).
 *
 * ## 왜 필요한가 — 번들러도 린터도 SVG 를 파싱하지 않는다
 *
 * 이 자산들은 전부 `<img src="/illustrations/….svg">` 로 그려진다. 그 경로는 Next 가
 * 손대지 않는 `public/` 정적 파일이라 **빌드 어디에서도 내용이 검사되지 않고**, 브라우저는
 * `img` 로 들어온 SVG 를 **엄격 XML 파서**로 읽는다. 그래서 문법이 어긋나면 빌드는 초록불인
 * 채로 화면에만 깨진 이미지가 뜬다 — #841 의 `packing-empty.svg` 가 그렇게 나갔다.
 *
 * ## 무엇에 걸렸나
 *
 * **XML 주석은 하이픈 둘을 연달아 담을 수 없다.** 이 저장소의 주석은 근거를 길게 적고 그
 * 안에 CSS 변수 이름이 자주 등장하는데(`fg-subtle` 같은 토큰은 앞에 하이픈 둘이 붙는다),
 * 그 이름을 그대로 적는 순간 파일 전체가 파싱 실패한다. 실패 지점이 주석이라 **눈으로는
 * 멀쩡해 보이는 것**이 이 결함의 성질이다.
 *
 * ## 왜 파서를 들이지 않았나
 *
 * 이 저장소의 vitest 는 `environment: 'node'` 라 `DOMParser` 가 없고, XML 파서를 의존성으로
 * 들이면 이 한 파일을 위해 프로덕션 트리 밖 패키지가 하나 는다. 실제로 난 결함과 앞으로 날
 * 결함의 모양이 **주석 안 하이픈 둘** 하나로 같으므로 그 모양을 직접 센다. 다른 모양의
 * 문법 오류가 실제로 나면 그때 파서를 들인다.
 */
const ILLUSTRATIONS_DIR = fileURLToPath(new URL('../../public/illustrations', import.meta.url))

function readIllustration(name: string): string {
  return readFileSync(`${ILLUSTRATIONS_DIR}/${name}`, 'utf8')
}

const FILES = readdirSync(ILLUSTRATIONS_DIR).filter((name) => name.endsWith('.svg'))

/** `<!--` 와 `-->` 사이의 본문만 모은다 — 바깥의 경로·속성에는 이 규칙이 없다 */
function commentBodies(svg: string): string[] {
  return [...svg.matchAll(/<!--([\s\S]*?)-->/g)].map((match) => match[1] ?? '')
}

describe('public/illustrations/*.svg — XML 로 읽힌다', () => {
  /* 폴더가 비면 아래 단언들이 0회 돌고도 초록불이 된다 */
  it('검사할 자산이 있다', () => {
    expect(FILES.length).toBeGreaterThan(0)
  })

  it.each(FILES)('%s — 주석 안에 하이픈 둘이 없다', (name) => {
    const bodies = commentBodies(readIllustration(name))

    for (const body of bodies) {
      expect(body).not.toContain('--')
    }
  })

  it.each(FILES)('%s — 여는 태그와 닫는 태그가 svg 다', (name) => {
    const svg = readIllustration(name).trim()

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })
})
