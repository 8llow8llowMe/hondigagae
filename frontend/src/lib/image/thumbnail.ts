import { imageSrc } from '@/lib/image/remote-host'

/**
 * 목록 썸네일(80~96px 칸)의 src — **작은 사진이 먼저다** (#1132).
 *
 * TourAPI 는 한 장소에 두 크기를 준다 (2026-10-03 실측, `docs/seo-review-2026-10-03.md` §3):
 * `firstImage`(`…_image2_1.jpg`) 940×627 · 장당 500~780KB, `firstImage2`(`…_image3_1.jpg`)
 * 150×100 · ~20KB. 96px 칸에 940px 원본을 받으면 `/places` 한 화면이 이미지만 6.5MB 였다.
 * 150px 는 2배 밀도 기준(192px)에 조금 모자라지만, **`images.unoptimized` 라 리사이즈 경로가
 * 없는 지금은** 25배 전송량과 맞바꿀 값이 아니다 — 흐림이 거슬리면 리사이즈 경로(같은 문서
 * §3-2 #3)로 넘어간다.
 *
 * **판정을 두 번 한다** — `imageSrc(small ?? large)` 가 아니다. 작은 쪽이 **있지만 못 쓰는**
 * URL(허용 목록 밖 호스트 · 빈 문자열)이면 그렇게 고른 순간 쓸 수 있는 큰 사진을 두고
 * "사진 없음" 이 된다.
 *
 * **카드처럼 큰 칸에는 쓰지 않는다** — 홈 카드(320px)는 150px 를 늘리면 뭉개진다.
 */
export function listThumbnailSrc(small: string | null, large: string | null): string | null {
  return imageSrc(small) ?? imageSrc(large)
}
