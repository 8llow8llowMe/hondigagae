import type { KakaoMaps } from '@/types/kakao-maps'

/**
 * 카카오 지도 SDK 로더.
 *
 * 규약은 docs/external-api-guide.md §1 이고, 여기서 강제하는 것은 넷이다.
 *
 *  1. **`autoload=false` + `kakao.maps.load(cb)`** — 콜백 없이 바로 `new kakao.maps.Map()`
 *     하면 간헐적으로 실패한다.
 *  2. **중복 로드 금지** — 라우트를 오갈 때마다 `<script>` 가 쌓이면 SDK 가 전역을
 *     다시 초기화하며 기존 지도 인스턴스가 죽는다. 모듈 스코프 Promise 하나로 가둔다.
 *  3. **실패를 종류별로 구분** — 키가 없는 것(설정 문제)과 스크립트가 못 뜬 것(네트워크·
 *     도메인 미등록)은 사용자에게 할 말이 다르다.
 *  4. **서버에서 부르지 않는다** — `document` 가 없다. 호출부는 `ssr: false` 로 감싸지만
 *     여기서도 한 번 더 막는다.
 */

/** SDK 실패 종류. 화면 문구가 이 값으로 갈린다 */
export type MapSdkFailure = 'unsupported' | 'no-key' | 'script'

export class MapSdkError extends Error {
  constructor(readonly reason: MapSdkFailure) {
    super(`kakao maps sdk unavailable: ${reason}`)
    this.name = 'MapSdkError'
  }
}

const SDK_ORIGIN = 'https://dapi.kakao.com/v2/maps/sdk.js'

/**
 * SDK 스크립트 URL.
 *
 * 순수 함수로 떼어 둔 이유는 `autoload=false` 누락이 조용한 사고이기 때문이다 —
 * 빠뜨려도 대부분의 경우 동작하고 느린 회선에서만 깨진다. 테스트로 고정한다.
 */
export function kakaoSdkUrl(appKey: string): string {
  // `libraries` 를 붙이지 않는다. 묶음 마커는 SDK 의 MarkerClusterer 가 아니라
  // `lib/map/cluster.ts` 가 계산한다 — 우리 핀이 라벨을 가진 CustomOverlay 라
  // 그 라이브러리가 묶지 못하고, 묶음도 **보이는 글자(숫자)와 읽히는 이름
  // ("이 지역 12곳")이 다른** 마커라 기본 렌더로는 그 둘을 가를 수 없다
  const params = new URLSearchParams({
    appkey: appKey,
    autoload: 'false',
  })
  return `${SDK_ORIGIN}?${params.toString()}`
}

/**
 * 환경변수에서 앱 키를 읽는다.
 *
 * `NEXT_PUBLIC_*` 는 **빌드 시점에 문자열로 인라인**되므로 `process.env` 를 동적
 * 인덱싱하면 치환되지 않는다. 반드시 리터럴 접근이어야 한다 (.env.example 주석).
 */
export function readMapKey(): string | null {
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY
  return key !== undefined && key.trim() !== '' ? key.trim() : null
}

/** 모듈 스코프 싱글턴 — 중복 로드 방지의 실체다 */
let pending: Promise<KakaoMaps> | null = null

/**
 * SDK 를 한 번만 로드하고 초기화된 `kakao.maps` 를 준다.
 *
 * 두 번째 호출부터는 같은 Promise 를 돌려준다. **실패한 Promise 는 버린다** —
 * 네트워크가 돌아온 뒤 사용자가 "다시 시도" 를 눌렀을 때 영원히 같은 실패를
 * 재생하면 안 된다.
 */
export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (pending !== null) return pending

  pending = start().catch((error: unknown) => {
    pending = null
    throw error
  })

  return pending
}

function start(): Promise<KakaoMaps> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new MapSdkError('unsupported'))
  }

  const appKey = readMapKey()
  if (appKey === null) return Promise.reject(new MapSdkError('no-key'))

  // 다른 탭·이전 세션에서 이미 붙어 초기화까지 끝난 경우
  const loaded = window.kakao?.maps
  if (loaded !== undefined) return ready(loaded)

  return injectScript(kakaoSdkUrl(appKey)).then(() => {
    const maps = window.kakao?.maps
    if (maps === undefined) throw new MapSdkError('script')
    return ready(maps)
  })
}

/** `autoload=false` 라 초기화를 우리가 트리거한다 */
function ready(maps: KakaoMaps): Promise<KakaoMaps> {
  return new Promise((resolve) => {
    maps.load(() => resolve(maps))
  })
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing !== null) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new MapSdkError('script')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new MapSdkError('script')), { once: true })
    document.head.appendChild(script)
  })
}

/** 테스트 전용 — 싱글턴을 비운다. 런타임 코드에서 부르지 않는다 */
export function resetKakaoMapsLoaderForTest(): void {
  pending = null
}
