/**
 * `next/image` 가 허용하는 외부 이미지 호스트.
 *
 * **`next.config.ts` 가 이 목록을 임포트한다.** 두 곳에 같은 목록을 적으면 반드시 어긋나고,
 * 어긋난 쪽으로 URL이 들어오면 `next/image` 가 **런타임에 던져 화면 전체가 죽는다.**
 *
 * 근거: 백엔드가 TourAPI 원본 URL을 그대로 저장한다
 * (backend/docs/entity-design.md: first_image, origin_img_url — VARCHAR(300) 원본 URL).
 *
 * TODO(BE): 백엔드 기동 후 실호출로 실제 이미지 호스트를 확인해 목록을 보강한다.
 * mock 데이터가 이미지를 전부 null 로 두고 있어 아직 검증하지 못했다
 * (docs/features/place/장소상세-세부명세.md D5-4).
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
