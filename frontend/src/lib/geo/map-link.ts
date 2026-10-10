import { toLatLng } from '@/lib/geo/coord'

/**
 * 외부 지도 앱 길찾기 링크.
 *
 * **경로 안내를 우리가 그리지 않는다** (아트보드 `혼디가개 긴급 시설` 02절).
 * 좌표를 카카오맵 링크로 넘기면 앱이 설치돼 있으면 앱이, 없으면 웹이 받는다 —
 * 우리가 앱 설치 여부를 판별하려 들면 iOS 에서 빈 탭만 남는 전형적인 실패를 만든다.
 *
 * `map.kakao.com/link/to/{이름},{위도},{경도}` 가 공식 링크 규격이고 **위도가 먼저**다.
 * 지도 SDK 의 `LatLng(위도, 경도)` 와 순서가 같다.
 */

const KAKAO_LINK_ORIGIN = 'https://map.kakao.com/link/to'

/**
 * 좌표가 없으면 `null` 이다. 호출부는 버튼을 그리지 않는다 —
 * 눌러도 아무 데도 못 가는 "길찾기" 는 없는 것만 못하다.
 */
export function directionsUrl(target: {
  name: string
  lat: number | null | undefined
  lng: number | null | undefined
}): string | null {
  const coord = toLatLng(target)
  if (coord === null) return null

  // 이름에 콤마가 있으면 링크 규격의 구분자와 충돌한다. 인코딩이 그것까지 처리한다
  const name = encodeURIComponent(target.name.trim() === '' ? '목적지' : target.name.trim())

  return `${KAKAO_LINK_ORIGIN}/${name},${coord.lat},${coord.lng}`
}
