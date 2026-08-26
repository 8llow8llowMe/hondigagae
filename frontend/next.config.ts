import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // dev 서버는 /_next/* 에 대한 cross-origin 요청을 기본 차단한다.
  // localhost 가 아닌 호스트(IP, LAN 주소, 다른 기기)로 접근하면 청크가 403 이 되고
  // **SSR HTML 은 정상인데 하이드레이션만 죽는다** — 조용해서 진단이 어렵다.
  allowedDevOrigins: ['127.0.0.1'],

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
