/**
 * 카카오 지도 SDK 의 **우리가 쓰는 표면만** 선언한다.
 *
 * 공식 타입 패키지를 쓰지 않는 이유: SDK 를 `<script>` 로 늦게 붙이는 구조라
 * 패키지가 선언하는 전역과 실제 로드 시점이 어긋나고, `any` 로 뚫린 선언이 섞여 들어와
 * `@typescript-eslint/no-explicit-any: error` 와 충돌한다. 쓰는 만큼만 좁게 적는다.
 *
 * **`window.kakao` 를 모듈 스코프에서 읽지 않는다.** SSR 에서 `undefined` 다
 * (docs/external-api-guide.md §1). 반드시 `loadKakaoMaps()` 가 넘겨주는 참조를 쓴다.
 */

declare global {
  interface Window {
    kakao?: KakaoNamespace
  }
}

export type KakaoNamespace = {
  maps: KakaoMaps
}

export type KakaoMaps = {
  /** `autoload=false` 로 붙였을 때 초기화 완료 콜백 */
  load: (callback: () => void) => void

  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap
  Marker: new (options: KakaoMarkerOptions) => KakaoMarker
  CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay
  MarkerClusterer: new (options: KakaoClustererOptions) => KakaoClusterer
  event: {
    addListener: (target: object, type: string, handler: (...args: never[]) => void) => void
    removeListener: (target: object, type: string, handler: (...args: never[]) => void) => void
  }
}

export type KakaoLatLng = {
  getLat: () => number
  getLng: () => number
}

export type KakaoLatLngBounds = {
  extend: (latlng: KakaoLatLng) => void
  getSouthWest: () => KakaoLatLng
  getNorthEast: () => KakaoLatLng
}

export type KakaoMapOptions = {
  center: KakaoLatLng
  level?: number
}

/** `setLevel` 의 두 번째 인자 */
export type KakaoZoomOptions = {
  /** `true` 면 SDK 기본 지속시간, 객체면 밀리초를 지정한다 */
  animate?: boolean | { duration: number }
  /** 확대 중심으로 고정할 좌표. 주지 않으면 지도 중심이 기준이다 */
  anchor?: KakaoLatLng
}

export type KakaoMap = {
  setCenter: (latlng: KakaoLatLng) => void
  getCenter: () => KakaoLatLng
  setLevel: (level: number, options?: KakaoZoomOptions) => void
  getLevel: () => number
  getBounds: () => KakaoLatLngBounds
  setBounds: (bounds: KakaoLatLngBounds) => void
  /** 숨겨진 컨테이너에서 만들면 크기가 0 이라 노출 시 호출한다 */
  relayout: () => void
  panTo: (latlng: KakaoLatLng) => void
}

export type KakaoMarkerImage = object

export type KakaoMarkerOptions = {
  position: KakaoLatLng
  title?: string
  zIndex?: number
}

export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void
  getPosition: () => KakaoLatLng
  setZIndex: (zIndex: number) => void
}

export type KakaoCustomOverlayOptions = {
  position: KakaoLatLng
  content: HTMLElement | string
  yAnchor?: number
  xAnchor?: number
  zIndex?: number
  clickable?: boolean
}

export type KakaoCustomOverlay = {
  setMap: (map: KakaoMap | null) => void
  setZIndex: (zIndex: number) => void
}

export type KakaoClustererOptions = {
  map: KakaoMap
  averageCenter?: boolean
  minLevel?: number
  disableClickZoom?: boolean
}

export type KakaoClusterer = {
  addMarkers: (markers: KakaoMarker[]) => void
  clear: () => void
  setMap: (map: KakaoMap | null) => void
}
