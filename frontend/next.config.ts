import type { NextConfig } from 'next'

import { REMOTE_IMAGE_HOSTS } from './src/lib/image/remote-host'

const nextConfig: NextConfig = {
  // dev 서버는 /_next/* 에 대한 cross-origin 요청을 기본 차단한다.
  // localhost 가 아닌 호스트(IP, LAN 주소, 다른 기기)로 접근하면 청크가 403 이 되고
  // **SSR HTML 은 정상인데 하이드레이션만 죽는다** — 조용해서 진단이 어렵다.
  allowedDevOrigins: ['127.0.0.1'],

  images: {
    // 장소 이미지는 백엔드가 TourAPI 원본 URL을 그대로 저장한다
    // (backend/docs/entity-design.md: first_image, origin_img_url — VARCHAR(300) 원본 URL).
    // 목록의 정본은 src/lib/image/remote-host.ts 다. 화면 코드가 같은 목록으로
    // isAllowedImageHost() 판정을 하므로, 두 곳에 따로 적으면 어긋난다.
    remotePatterns: REMOTE_IMAGE_HOSTS.flatMap((hostname) => [
      { protocol: 'http' as const, hostname },
      { protocol: 'https' as const, hostname },
    ]),
  },
}

export default nextConfig
