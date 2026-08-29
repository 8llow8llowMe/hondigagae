/**
 * 행 메타 줄에 쓰는 짧은 주소.
 *
 * 아트보드(`혼디가개 장소 찾기.dc.html` 01·03 절)의 행 메타는 `제주시 한림읍` 처럼
 * **읍·면·동까지**다. 원천 `addr1` 은 `제주특별자치도 제주시 한림읍 용금로 906-107` 처럼
 * 번지까지 오므로 그대로 두면 메타 줄이 제목보다 길어지고, 목록을 훑을 때 읽히지 않는다.
 *
 * 규칙은 두 가지뿐이다.
 *  1. 광역 접두(`제주특별자치도`)는 버린다 — 제주 한 지역만 다루는 서비스라 전 행이 같다
 *  2. 남은 어절 중 **행정구역 접미(시·군·구·읍·면·동·리)로 끝나는 것까지**만 남긴다
 *
 * 규칙에 걸리는 어절이 없으면 **원문을 그대로 돌려준다.** 주소 체계를 벗어난 값(원천마다
 * 품질이 다르다)을 억지로 자르면 뜻이 바뀐 문자열이 나간다 — 자르지 못하는 것이 낫다.
 *
 * 상세 화면은 이 함수를 쓰지 않는다. 거기서는 전체 주소가 필요한 정보다.
 */
const WIDE_AREA_SUFFIX = /(특별자치도|특별자치시|특별시|광역시|도)$/
const DISTRICT_SUFFIX = /(시|군|구|읍|면|동|리)$/

export function shortAddress(addr1: string | null): string | null {
  if (addr1 === null) return null

  const trimmed = addr1.trim()
  if (trimmed === '') return null

  const words = trimmed.split(/\s+/)
  const start = words[0] !== undefined && WIDE_AREA_SUFFIX.test(words[0]) ? 1 : 0

  // 뒤에서부터 훑어 마지막 행정구역 어절을 찾는다 — `한림읍 용금로` 에서 `용금로` 를 버린다
  let end = -1
  for (let index = words.length - 1; index >= start; index -= 1) {
    const word = words[index]
    if (word !== undefined && DISTRICT_SUFFIX.test(word)) {
      end = index
      break
    }
  }

  if (end < start) return trimmed

  return words.slice(start, end + 1).join(' ')
}
