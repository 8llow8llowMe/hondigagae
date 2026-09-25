import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { aboutMessages } from '@/lib/messages/about'
import { homeMessages } from '@/lib/messages/home'

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

/*
  **#206.** 홈 응급 배너가 `제주 24시간 병원은 3곳뿐이에요` 로 개수를 단정하고 있었다.
  백엔드가 이 수를 주지 않아 하드코딩이었고, 배너를 눌러 들어간 화면은 실제 값을 쓰므로
  데이터가 어긋나는 순간 **홈은 "3곳" 이라고 말하고 목록은 "반경 안에 없어요" 라고 말한다** —
  dev 에서 실제로 그랬다 (`/emergencies/facilities` 가 0건).

  주석으로 "숫자를 단정하지 마세요" 라고 적어 두면 반드시 어긋난다. 그래서 테스트로 잡는다
  (이 파일의 어미 규칙과 같은 판단).
*/
describe('개수를 단정하는 문구 — 서버가 세는 값을 FE 가 적어 두지 않는다', () => {
  it('홈 응급 배너 문구에 개수가 박혀 있지 않다', () => {
    expect(homeMessages.emergencyDesc).not.toMatch(/\d+\s*곳/)
  })
})

/**
 * 소개 페이지(#635) 문구 — 규모 숫자는 `features/about/about-specimen-data.ts` 의 상수이고
 * **문구에는 없다.** 홈 응급 배너가 `3곳` 이라 말하는 동안 목록은 0건이던 위의 사례와 같은
 * 판단이다. 예외 없이 `aboutMessages` 전체를 훑는다.
 */
describe('소개 페이지 문구 — 개수를 적어 두지 않는다', () => {
  function leaves(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(leaves)
    if (value !== null && typeof value === 'object') return Object.values(value).flatMap(leaves)
    return []
  }

  it('aboutMessages 어디에도 "N곳" 이 없다', () => {
    expect(leaves(aboutMessages).filter((text) => /\d+\s*곳/.test(text))).toEqual([])
  })
})

/**
 * **낱말 규칙 — `판정` 을 쓰지 않는다** (#942, #940 사용자 검토).
 *
 * "심판받는 느낌이라 와닿지 않는다" 는 검토였다. 이름으로 쓸 때는 `오늘 상태`(일정의 날짜별
 * 값은 이미 쓰던 `적합도`), 문장 안에서는 `알려 줘요` · `안내해요` 로 푼다. 장소를 `거른다`,
 * 조건이 `갈린다` 도 같이 걷었다 — `안내해요` · `다른` 으로 쓴다. `원천` 은 `데이터` · `출처` ·
 * `원문` 으로 쓴다 (#948).
 *
 * 소개 페이지가 먼저 바꿨고(`about-view.test.ts` "낱말 규칙"), 여기는 **모든 메시지 파일**을
 * 덮는다. 주석은 문구가 아니라 보지 않는다 — 값 문자열과 문구 함수의 본문만 훑는다. 코드
 * 식별자(`verdict` 등)와 서버가 내려주는 문장은 이 규칙 밖이다.
 */
describe('낱말 규칙 — 판정 · 거르다 · 갈리다 · 원천을 쓰지 않는다 (#942 · #948)', () => {
  function copyOf(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (typeof value === 'function') return [value.toString()]
    if (Array.isArray(value)) return value.flatMap(copyOf)
    if (value !== null && typeof value === 'object') return Object.values(value).flatMap(copyOf)
    return []
  }
  const copy = copyOf(messages)

  it.each([
    ['판정', '이름은 "오늘 상태" · "적합도", 문장은 "알려 줘요 · 안내해요"'],
    ['거르', '장소를 거르지 않고 안내한다'],
    ['거른', '장소를 거르지 않고 안내한다'],
    ['걸러', '장소를 거르지 않고 안내한다'],
    ['갈리', '"다른" 으로 쓴다'],
    ['갈린', '"다른" 으로 쓴다'],
    ['원천', '"데이터 · 출처 · 원문" 으로 쓴다 (#948)'],
  ])('화면 문구에 없다: "%s" — %s', (word) => {
    // 훑을 대상이 비면 이 단언은 무엇이든 통과한다
    expect(copy.length).toBeGreaterThan(500)
    expect(copy.filter((text) => text.includes(word))).toEqual([])
  })
})
