/**
 * `next/image` 가 허용하는 외부 이미지 호스트.
 *
 * **`next.config.ts` 가 이 목록을 임포트한다.** 두 곳에 같은 목록을 적으면 반드시 어긋나고,
 * 어긋난 쪽으로 URL이 들어오면 `next/image` 가 **런타임에 던져 화면 전체가 죽는다.**
 *
 * 근거: 백엔드가 TourAPI 원본 URL을 그대로 저장한다
 * (backend/docs/entity-design.md: first_image, origin_img_url — VARCHAR(300) 원본 URL).
 *
 * **실측으로 확인했다 (2026-09-04, dev 게이트웨이 제주 400건 표본).** 이미지 URL 의 호스트는
 * `tong.visitkorea.or.kr` 하나뿐이고, 출처가 `관광정보 API` 인 장소만 이미지를 가진다
 * (124건 중 119건). 문화정보원 174건·식약처 102건은 `firstImage` 가 전부 null 이다.
 */
export const REMOTE_IMAGE_HOSTS = ['tong.visitkorea.or.kr'] as const

/** 이 URL을 next/image 에 넘겨도 되는가. 아니면 플레이스홀더로 떨어뜨린다 */
export function isAllowedImageHost(url: string | null): boolean {
  if (url === null || url.trim().length === 0) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  return (REMOTE_IMAGE_HOSTS as readonly string[]).includes(parsed.hostname)
}

/**
 * `next/image` 에 넘길 수 있는 src. 넘길 수 없으면 `null` 이다.
 *
 * 판정과 **https 승격**을 한 곳에서 한다. 호출부가 `isAllowedImageHost(x) && x !== null` 로
 * 두 번 묻고 `x as string` 으로 단정하던 자리를 이 함수가 대신한다.
 *
 * **왜 https 로 올리는가.** 백엔드는 TourAPI 원본 URL 을 그대로 저장하고 그것이 `http://` 다
 * (dev 실측). `next.config.ts` 가 `unoptimized: true` 라 그 URL 이 브라우저에 그대로 나가는데,
 * **https 로 서비스되는 dev·prod 에서는 mixed content 로 차단된다** — 로컬(http)에서는
 * 드러나지 않는 종류의 결함이다. 같은 파일을 https 로 받아도 200 · 동일 바이트다.
 */
export function imageSrc(url: string | null): string | null {
  if (!isAllowedImageHost(url)) return null

  // isAllowedImageHost 를 통과했으므로 파싱이 실패하지 않는다
  const parsed = new URL(url as string)
  parsed.protocol = 'https:'
  return parsed.toString()
}
