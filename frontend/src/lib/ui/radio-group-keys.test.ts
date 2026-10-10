import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { nextRadioIndex, radioTabIndex } from '@/lib/ui/radio-group-keys'

/**
 * WAI-ARIA 라디오 그룹 키보드 규약 — [#825](https://github.com/8llow8llowMe/hondigagae/issues/825).
 *
 * **고를 수 있는 것만 여기서 잠근다.** 포커스가 실제로 옮겨 갔는지는 `renderToStaticMarkup`
 * 문자열로 볼 수 없어 `e2e/radio-group-keyboard.spec.ts` 가 잰다 (`testing-guide.md` §5 와
 * 같은 선 — `lib/map/cluster.ts` 의 순수 함수/DOM 배선 분리를 따랐다).
 *
 * **화면별 `tabindex` 단언은 각 컴포넌트 옆에 있다** — `lib/**` 은 `features/**` 를 임포트할 수
 * 없다(architecture-guide §3). 여기서는 대신 **빠뜨린 묶음이 없는지**를 소스 훑기로 잡는다.
 */
describe('nextRadioIndex — 화살표가 옮기는 자리', () => {
  it('다음 칸으로 간다 — 가로·세로 둘 다 받는다', () => {
    expect(nextRadioIndex('ArrowRight', 0, 3)).toBe(1)
    expect(nextRadioIndex('ArrowDown', 0, 3)).toBe(1)
  })

  it('이전 칸으로 간다', () => {
    expect(nextRadioIndex('ArrowLeft', 2, 3)).toBe(1)
    expect(nextRadioIndex('ArrowUp', 2, 3)).toBe(1)
  })

  /**
   * **끝에서 감는다.** 감지 않으면 마지막 칸의 화살표가 죽은 키가 되고, 사용자는 그것을
   * "고장" 과 구분하지 못한다.
   */
  it('끝에서 감는다', () => {
    expect(nextRadioIndex('ArrowRight', 2, 3)).toBe(0)
    expect(nextRadioIndex('ArrowLeft', 0, 3)).toBe(2)
  })

  it('Home · End 는 양 끝이다', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0)
    expect(nextRadioIndex('End', 0, 3)).toBe(2)
  })

  /** 포커스가 묶음 밖인데 키를 가로채면 페이지 스크롤을 먹는다 */
  it('포커스가 묶음 밖이면 옮기지 않는다', () => {
    expect(nextRadioIndex('ArrowRight', -1, 3)).toBeNull()
    expect(nextRadioIndex('ArrowRight', 3, 3)).toBeNull()
  })

  it('칸이 없으면 Home 도 옮기지 않는다', () => {
    expect(nextRadioIndex('Home', -1, 0)).toBeNull()
  })

  /** 규약에 없는 키는 그대로 흘린다 — Tab 을 가로채면 묶음을 빠져나갈 수 없다 */
  it('Tab · Enter · 문자 키는 옮기지 않는다', () => {
    expect(nextRadioIndex('Tab', 0, 3)).toBeNull()
    expect(nextRadioIndex('Enter', 0, 3)).toBeNull()
    expect(nextRadioIndex('a', 0, 3)).toBeNull()
  })

  it('한 칸뿐이면 제자리다', () => {
    expect(nextRadioIndex('ArrowRight', 0, 1)).toBe(0)
  })
})

describe('radioTabIndex — 고른 칸만 탭 스톱이다', () => {
  it('고른 칸이 0, 나머지가 -1 이다', () => {
    expect(radioTabIndex(true)).toBe(0)
    expect(radioTabIndex(false)).toBe(-1)
  })
})

/**
 * **새로 만든 배타 묶음을 빠뜨리지 않게 한다.**
 *
 * 화면별 `tabindex` 단언은 각 컴포넌트 옆에 있지만(`filter-list.test.ts` ·
 * `chip.test.ts` · 세 세그먼트), 그 단언은 **이미 아는 묶음**만 본다. `role="radiogroup"`
 * 을 새로 쓰는 파일이 생기면 아무도 모른다 — #825 가 정확히 그렇게 넷으로 번졌다.
 *
 * 렌더가 아니라 소스를 읽는 이유는 **아직 존재하지 않는 컴포넌트**를 잡아야 해서다
 * (`testing-guide.md` §5 가 소스 단언을 허용하는 경우다).
 */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

describe('배타 묶음을 빠뜨리지 않는다 (#825)', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const groups = sourceFiles(root)
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => /role=\{?[^\n]*radiogroup/.test(source))

  it('radiogroup 을 그리는 파일을 찾는다 — 찾지 못하면 이 검사가 죽은 것이다', () => {
    expect(groups.length).toBeGreaterThanOrEqual(5)
  })

  it('radiogroup 을 그리는 파일은 전부 키 핸들러를 붙인다', () => {
    const missing = groups
      .filter(({ source }) => !source.includes('handleRadioGroupKeyDown'))
      .map(({ path }) => path.slice(root.length))

    expect(missing, `키 핸들러가 없는 배타 묶음: ${missing.join(', ')}`).toEqual([])
  })

  it('radiogroup 을 그리는 파일은 전부 roving tabindex 를 쓴다', () => {
    const missing = groups
      .filter(({ source }) => !source.includes('radioTabIndex'))
      .map(({ path }) => path.slice(root.length))

    expect(missing, `roving tabindex 가 없는 배타 묶음: ${missing.join(', ')}`).toEqual([])
  })
})
