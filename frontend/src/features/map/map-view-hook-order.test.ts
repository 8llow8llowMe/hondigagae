/**
 * 두 지도 보기의 **훅이 전부 조기 반환보다 앞에 있는지** — PR #866 에서 실제로 밟았다.
 *
 * 두 화면 모두 SDK 실패 시 목록으로 되돌리는 `if (failure !== null) return (...)` 를
 * **컴포넌트 한가운데**에 두고 있다. 그래서 새 훅을 "쓰는 자리 바로 위" 에 두면 조기
 * 반환 **뒤**가 되기 쉽고, 그러면 `failure` 가 `null` → 값으로 뒤집히는 렌더에서
 * 훅 개수가 줄어 React 가 터진다 — **폴백 목록이 통째로 안 그려진다.**
 *
 * **단위 테스트도 타입 검사도 이것을 못 잡는다.** 이 저장소의 vitest 는 node 환경
 * 문자열 assertion 이라 두 컴포넌트를 렌더하지 않고, 훅 순서는 타입이 아니다.
 * PR #866 에서는 `pnpm verify` 가 전부 초록인 채로 e2e 만 빨간불이었고
 * (`emergency-search.spec.ts` 의 지도 갈래 검색 2건 — `MOCK_API=true` 라 카카오 키가
 * 없어 **항상** 폴백 갈래로 온다), 브라우저 실측은 SDK 가 정상이라 그 갈래를 안 탔다.
 *
 * eslint 의 `react-hooks/rules-of-hooks` 는 **조건부 호출**을 잡지만 조기 반환 뒤의
 * 최상위 호출은 잡지 않는다 — 그 자리에서는 문법적으로 조건부가 아니기 때문이다.
 * 그래서 소스 위치로 직접 잰다.
 */
import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments as source } from '@/test/source'

/** 훅 호출의 시작 위치를 전부 찾는다 — `const x = useMemo(` · `useEffect(` 등 */
const HOOK = /\buse[A-Z]\w*\(/g

const views = [
  { name: '긴급 시설 지도', path: 'src/features/emergency/emergency-map-view.tsx' },
  { name: '장소 찾기 지도', path: 'src/features/place/place-map-view.tsx' },
] as const

describe.each(views)('$name — 훅은 조기 반환보다 앞이다 (PR #866)', ({ path }) => {
  const code = source(path)
  const earlyReturn = code.indexOf('if (failure !== null)')

  it('SDK 실패 조기 반환이 컴포넌트 한가운데 있다 — 이 검사가 필요한 이유', () => {
    // 이 전제가 깨지면(폴백을 별 컴포넌트로 빼는 등) 이 파일의 검사도 다시 판단한다
    expect(earlyReturn).toBeGreaterThan(-1)
  })

  it('그보다 뒤에서 훅을 부르지 않는다', () => {
    const late = [...code.matchAll(HOOK)]
      .filter((match) => (match.index ?? 0) > earlyReturn)
      /*
        조기 반환 뒤의 본문에도 `useXxx` 글자가 나올 수 있다 — 다른 컴포넌트(같은 파일
        아래쪽의 `PanelBody` 등)가 자기 훅을 부르는 것은 정상이다. 여기서 막으려는 것은
        **이 컴포넌트 본문**의 훅이므로, 다음 `export function`/`function` 선언 전까지만 센다.
      */
      .filter((match) => {
        const nextComponent = code.indexOf('\nfunction ', earlyReturn)
        const nextExported = code.indexOf('\nexport function ', earlyReturn)
        const bodyEnd = Math.min(
          nextComponent === -1 ? code.length : nextComponent,
          nextExported === -1 ? code.length : nextExported,
        )
        return (match.index ?? 0) < bodyEnd
      })
      .map((match) => match[0])

    expect(late).toEqual([])
  })
})
