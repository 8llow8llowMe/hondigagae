import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as code } from '@/test/source'

/**
 * **next/image 에 `priority` 를 쓰지 않는다** — 이슈 #1146.
 *
 * Next 16.3 에서 deprecated 다(`Use preload prop instead`). 16.3 구현은 둘을 같게 다루지만
 * (`get-img-props.js` `preload: preload || priority`) 언젠가 빠질 이름이고, 둘을 같이 주면
 * Next 가 던진다. 우리 컴포넌트의 `priority` prop(`PlaceRow` 등, 앞 행을 먼저 받는 뜻)은
 * next/image 가 아니라 이 단언 밖이다 — `<Image` 여는 태그 안만 본다.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return path.endsWith('.tsx') ? [relative(ROOT, path)] : []
  })
}

describe('next/image priority 금지 (#1146)', () => {
  const files = [...tsxFiles(join(ROOT, 'src')), ...tsxFiles(join(ROOT, 'app'))]

  it('훑을 파일이 있다', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('<Image> 여는 태그에 priority 가 없다', () => {
    const offenders = files.filter((file) =>
      [...code(file).matchAll(/<Image\b[\s\S]*?\/>/g)].some((tag) => /\spriority\b/.test(tag[0])),
    )

    expect(offenders).toEqual([])
  })
})
