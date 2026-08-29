import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * **FE 가 쓴 문구의 어미를 해요체로 고정한다** — DESIGN.md §1 (이슈 #15).
 *
 * 디자인 리뷰에서 "조건에 맞는 장소가 없습니다"(합쇼체)와 "필터를 바꿔 다시
 * 찾아보세요."(해요체)가 같은 빈 화면에 나란히 있는 것이 잡혔다.
 *
 * 예외는 **백엔드 `ValidationMessage` 복제본**뿐이다. 그 줄들은 바로 위에 `// AUTH_101`
 * 같은 대응 코드 주석이 달려 있고, 서버가 같은 문구를 내려주므로 여기서 톤을 바꾸면
 * **같은 폼 안에서 클라이언트 검증과 서버 검증의 말투가 갈린다.**
 *
 * 주석으로 "해요체로 쓰세요" 라고 적어 두면 반드시 어긋난다. 그래서 테스트로 잡는다.
 */
const DIR = fileURLToPath(new URL('./', import.meta.url))

/** 백엔드 오류코드 주석. 이 줄 바로 다음의 문구는 복제본이라 톤을 바꾸지 않는다 */
const BACKEND_CODE = /^\s*\/\/\s*[A-Z]+_\d+/
/** 합쇼체 종결 — `~습니다` · `~입니다` */
const FORMAL = /'[^']*(습니다|입니다)\.?'/

function messageFiles(): { name: string; lines: string[] }[] {
  return readdirSync(DIR)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    .map((entry) => ({
      name: entry,
      lines: readFileSync(join(DIR, entry), 'utf8').split('\n'),
    }))
}

describe('문구 어미 — 해요체로 통일한다 (DESIGN.md §1)', () => {
  it('백엔드 복제본이 아닌 문구에 합쇼체가 남아 있지 않다', () => {
    const found = messageFiles().flatMap(({ name, lines }) =>
      lines.flatMap((line, index) => {
        if (!FORMAL.test(line)) return []
        // 주석 줄 자체는 문구가 아니다
        if (line.trim().startsWith('*') || line.trim().startsWith('//')) return []
        // 바로 위에 백엔드 오류코드가 달린 줄은 복제본이다
        if (BACKEND_CODE.test(lines[index - 1] ?? '')) return []

        return [`${name}:${index + 1} ${line.trim()}`]
      }),
    )

    expect(found).toEqual([])
  })

  it('복제본은 예외로 남아 있다 — 규칙이 서버 문구까지 덮지 않는다', () => {
    const copies = messageFiles().flatMap(({ lines }) =>
      lines.filter((line, index) => FORMAL.test(line) && BACKEND_CODE.test(lines[index - 1] ?? '')),
    )

    // 이 개수가 0 이 되면 복제본을 잘못 고친 것이다
    expect(copies.length).toBeGreaterThan(0)
  })
})
