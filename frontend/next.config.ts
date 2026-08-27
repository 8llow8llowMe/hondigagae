import type { NextConfig } from 'next'

import { REMOTE_IMAGE_HOSTS } from './src/lib/image/remote-host'

const nextConfig: NextConfig = {
  // 배포는 이 산출물(.next/standalone)만 컨테이너에 복사한다.
  // 컨테이너 안에서 pnpm install / next build 를 돌리지 않는다 — 배포 대상이
  // 라즈베리파이(aarch64)라 이미지 빌드에 몇 분씩 쓸 수 없기 때문이다.
  // 이 설정을 지우면 Jenkins 프론트 파이프라인이 빌드 후 검사에서 막힌다.
  // (Jenkinsfile.frontend-common.groovy / frontend-web.Dockerfile)
  output: 'standalone',

  // 추적 루트를 이 디렉터리로 고정한다. 비워두면 Next 가 lock 파일을 찾아 루트를 추론하는데,
  // 나중에 레포 최상단에 lock 파일이 생기면 backend/ 까지 훑게 된다.
  // 빌드는 항상 frontend/ 에서 실행하므로 cwd 가 곧 프로젝트 루트다.
  outputFileTracingRoot: process.cwd(),

  // dev 서버는 /_next/* 에 대한 cross-origin 요청을 기본 차단한다.
  // localhost 가 아닌 호스트(IP, LAN 주소, 다른 기기)로 접근하면 청크가 403 이 되고
  // **SSR HTML 은 정상인데 하이드레이션만 죽는다** — 조용해서 진단이 어렵다.
  allowedDevOrigins: ['127.0.0.1'],

  images: {
    // 이미지 최적화를 끈다. 이유가 둘이다.
    // 1) 최적화에 쓰이는 sharp 는 플랫폼별 네이티브 바이너리다. 빌드는 x86_64 Jenkins
    //    빌더(ollama-01)에서, 실행은 aarch64 라즈베리파이에서 하므로 번들에 섞이면
    //    런타임에 로드가 실패한다. 실제로 이 설정 없이 빌드하면 standalone 안에
    //    @img/sharp-*-x64 가 들어간다.
    // 2) 배포 호스트가 라즈베리파이라 온디맨드 이미지 리사이즈를 감당할 CPU 여유가 없다.
    unoptimized: true,

    // 장소 이미지는 백엔드가 TourAPI 원본 URL을 그대로 저장한다
    // (backend/docs/entity-design.md: first_image, origin_img_url — VARCHAR(300) 원본 URL).
    // 목록의 정본은 src/lib/image/remote-host.ts 다. 화면 코드가 같은 목록으로
    // isAllowedImageHost() 판정을 하므로, 두 곳에 따로 적으면 어긋난다.
    // (위 unoptimized 때문에 Next 가 이 목록으로 최적화 요청을 검사하지는 않지만,
    //  최적화를 다시 켜는 순간 필요해지므로 그대로 둔다)
    remotePatterns: REMOTE_IMAGE_HOSTS.flatMap((hostname) => [
      { protocol: 'http' as const, hostname },
      { protocol: 'https' as const, hostname },
    ]),
  },

  // sharp 를 추적 대상에서 아예 뺀다. unoptimized 라 런타임에 쓰이지 않는데도
  // next 의 optional dependency 라서 그냥 두면 번들에 들어간다.
  // 번들에 네이티브 바이너리가 하나도 없어야 배포 파이프라인의 아키텍처 검사가 의미를 가진다.
  // 경로 앞에 **/ 가 필요하다. pnpm 은 node_modules/.pnpm/sharp@x/node_modules/sharp 처럼
  // 한 단계 더 들어간 곳에 실물을 두기 때문에 node_modules/sharp 로 시작하는 패턴은 빗나간다.
  outputFileTracingExcludes: {
    '*': ['**/node_modules/sharp/**', '**/node_modules/@img/**'],
  },
}

export default nextConfig
