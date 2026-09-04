import type { PlaceImage } from '@/types/place'

/**
 * 상단 갤러리에 넘길 사진 목록.
 *
 * **계약에 사진이 두 자리로 온다.** `images[]`(추가 이미지)와 `firstImage`(대표 이미지)다.
 * 상세가 `images` 만 보면 사진이 있는 장소도 한 장도 못 보인다 — dev 실측에서
 * `images` 는 전부 빈 배열이고 사진은 `firstImage` 로만 왔다 (제주 400건 표본 중 119건,
 * 모두 출처가 `관광정보 API`).
 *
 * **대표 이미지 자리를 따로 만들지 않는다.** 명세 D5 의 nullable 표에는 "`firstImage` null
 * 이면 플레이스홀더, 16:9 유지" 가 남아 있지만 그것은 폐기된 판(#11)의 잔재로,
 * `DESIGN.md` §7-3(**0장이면 섹션 미렌더**, 고정 높이 214/300)과 어긋난다. 사진이 아예
 * 없는 장소가 표본의 70% 라, 회색 "이미지 없음" 면을 상세 첫 화면에 두면 그 면이 화면의
 * 첫인상이 된다. 목록 썸네일은 반대다 — 거기서는 행 높이를 지켜야 해 타일을 남긴다.
 *
 * 호스트 허용 판정은 하지 않는다. `PhotoGallery` 가 `imageSrc` 로 한 번만 한다 —
 * 두 곳에서 걸러 내면 한쪽 규칙이 바뀔 때 조용히 어긋난다.
 */
export function galleryImages(
  images: readonly PlaceImage[],
  firstImage: string | null,
  cpyrhtDivCd: string | null,
): PlaceImage[] {
  if (images.length > 0) return [...images]
  if (firstImage === null || firstImage.trim().length === 0) return []

  /*
    `firstImage2`(썸네일)는 넣지 않는다 — 같은 사진의 다른 크기라 캐러셀에 두 장으로
    보이면 사용자는 사진이 두 장 있다고 읽는다 (명세 D3 "렌더하지 않는 필드").
  */
  return [{ originImgUrl: firstImage, smallImageUrl: null, imgName: null, cpyrhtDivCd }]
}
