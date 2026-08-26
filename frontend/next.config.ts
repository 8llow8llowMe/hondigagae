import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // 장소 이미지는 백엔드가 TourAPI 원본 URL을 그대로 저장한다
    // (backend/docs/entity-design.md: first_image, origin_img_url — VARCHAR(300) 원본 URL).
    // 등록하지 않으면 next/image 가 전부 실패한다. 신규 호스트가 나타나면
    // docs/tooling-guide.md §8 과 이 목록을 함께 갱신한다.
    remotePatterns: [
      { protocol: 'http', hostname: 'tong.visitkorea.or.kr' },
      { protocol: 'https', hostname: 'tong.visitkorea.or.kr' },
    ],
  },
}

export default nextConfig
