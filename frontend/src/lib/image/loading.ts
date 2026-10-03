/**
 * 목록 사진의 로드 방식 — **첫 화면에 서는 몇 장만 바로 받는다** (#1132).
 *
 * `next/image` 의 기본은 `loading="lazy"` 다. 목록 첫 카드처럼 **첫 화면의 가장 큰 그림(LCP)
 * 이 lazy 면** 브라우저가 레이아웃을 마친 뒤에야 요청을 낸다 — `/olle` 실측 LCP 6.8s ·
 * Lighthouse `lcp-lazy-loaded` 실패 (`docs/seo-review-2026-10-03.md` §3).
 *
 * **`priority` 가 아니라 `loading="eager"` + `fetchPriority="high"` 다.**
 * - Next 16 에서 `priority` 는 deprecated 이고 (`preload` 로 바뀌었다), 둘 다 `<head>` 에
 *   `<link rel="preload">` 를 장마다 꽂는다. 사진이 이미 서버 렌더 HTML 의 `<img>` 로 있어
 *   브라우저가 일찍 발견하므로 링크가 더해 주는 것이 없고, 목록 몇 장마다 링크가 쌓인다.
 *   Next 문서도 첫 화면 이미지에는 `loading="eager"` 를 권한다.
 * - `fetchPriority="high"` 는 같은 순간에 나가는 스크립트·글꼴보다 사진을 앞세운다.
 *
 * 나머지는 `lazy` 를 **명시**한다 — 기본값과 같지만, 갈래가 둘인 것이 호출부에서 보인다.
 */
export type ImageLoadingProps = { loading: 'eager'; fetchPriority: 'high' } | { loading: 'lazy' }

export function imageLoadingProps(priority: boolean): ImageLoadingProps {
  return priority ? { loading: 'eager', fetchPriority: 'high' } : { loading: 'lazy' }
}
