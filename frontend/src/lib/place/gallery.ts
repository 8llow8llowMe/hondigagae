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
 * `DESIGN.md` §7-3(고정 높이 214/300)과 어긋난다. 사진이 아예 없는 장소가 표본의 70% 라,
 * 회색 "이미지 없음" 면을 상세 첫 화면에 두면 그 면이 화면의 첫인상이 된다.
 *
 * **빈 배열은 "사진이 없다" 는 뜻이고, 그 자리를 무엇으로 채울지는 여기서 정하지 않는다.**
 * `PhotoGallery` 가 카테고리 일러스트를 세우고(#241 · #247), 자산이 없는 카테고리에서만
 * 섹션을 접는다 — 이 함수는 **사진만 모은다.** 일러스트를 여기서 끼워 넣으면 "사진 목록" 이
 * 사진이 아닌 것을 담게 되고, 장수 카운터(`1/8`)와 뷰어가 그것을 사진으로 센다.
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

/**
 * **대표 사진을 맨 앞에 둔** 사진 목록 — 지도 미리보기용 (#1230).
 *
 * 백엔드는 `images` 가 비었을 때만 대표(`firstImage`)로 폴백하고, 있으면 TourAPI 상세 이미지 목록을
 * 그대로 준다 — **그 목록에 대표 사진이 없다**(dev 30곳 중 2장↑ 29곳 전부 `images[0] ≠ firstImage`,
 * 12곳 중 11곳은 목록 어디에도 없음, 리뷰 실측). 미리보기는 상세 응답 전에 목록 행의 대표 사진으로
 * 먼저 서므로, 응답이 오면 **방금 본 사진이 다른 사진으로 바뀌고 다시 볼 수 없었다.** 그래서 대표를
 * 첫 장으로 고정하고 같은 URL 은 한 번만 둔다.
 *
 * 상세 갤러리(`galleryImages`)는 바꾸지 않았다 — 상세는 목록 행을 거치지 않아 바뀌는 순간이 없다.
 */
export function galleryImagesLeadingFirst(
  images: readonly PlaceImage[],
  firstImage: string | null,
  cpyrhtDivCd: string | null,
): PlaceImage[] {
  const fallback = galleryImages(images, firstImage, cpyrhtDivCd)
  if (images.length === 0 || firstImage === null || firstImage.trim().length === 0) return fallback

  const lead: PlaceImage = {
    originImgUrl: firstImage,
    smallImageUrl: null,
    imgName: null,
    cpyrhtDivCd,
  }
  return [lead, ...images.filter((image) => image.originImgUrl !== firstImage)]
}
