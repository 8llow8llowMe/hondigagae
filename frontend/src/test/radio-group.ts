/**
 * 배타 묶음의 roving `tabindex` 를 재는 공용 헬퍼
 * ([#825](https://github.com/8llow8llowMe/hondigagae/issues/825)).
 *
 * **여는 태그로 범위를 좁힌다.** 마크업 전체에서 `tabindex="0"` 을 세면 같은 화면의 다른
 * 요소가 낸 값이 섞여 false-green 이 된다.
 */
export function radioTabIndexes(markup: string): string[] {
  return [...markup.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((match) => {
    const found = /tabindex="(-?\d+)"/.exec(match[0])
    return found?.[1] ?? '없음'
  })
}

/** 묶음 하나가 탭 스톱 하나다 — 고른 칸만 `0`, 나머지는 전부 `-1` */
export function expectSingleTabStop(markup: string): void {
  const tabIndexes = radioTabIndexes(markup)

  if (tabIndexes.length < 2) {
    throw new Error(`배타 묶음에 칸이 ${tabIndexes.length}개뿐이다 — 렌더가 잘못됐다`)
  }
  if (tabIndexes.filter((value) => value === '0').length !== 1) {
    throw new Error(`탭 스톱이 하나가 아니다: ${tabIndexes.join(' · ')}`)
  }
  if (!tabIndexes.every((value) => value === '0' || value === '-1')) {
    throw new Error(`roving 이 아닌 칸이 있다: ${tabIndexes.join(' · ')}`)
  }
}
