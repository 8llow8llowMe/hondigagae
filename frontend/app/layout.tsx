import type { Metadata, Viewport } from 'next'

import { ScrollbarReveal } from '@/components/scrollbar-reveal'
import { MASK_ICON_COLOR, THEME_COLOR } from '@/lib/brand/chrome-colors'
import { QueryProvider } from '@/lib/query/query-provider'

// Pretendard Variable — unicode-range 로 분할된 dynamic subset.
// 브라우저가 **페이지에 실제 등장한 글자 범위만** 내려받는다 (조각 평균 31KB).
// 통짜 variable(2.0MB)이나 static 9종(6.6MB) 대비 초기 로드가 압도적으로 작다.
// 자세한 근거는 docs/tooling-guide.md §12.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'

/**
 * 배포 도메인. `metadataBase` 가 없으면 Next 가 `og:image` 를 상대 경로로 내보내고
 * 카카오톡·트위터 크롤러는 그것을 못 읽는다.
 *
 * 값은 `NEXT_PUBLIC_SITE_URL` 로 주입한다. 메타데이터는 서버에서만 만들어지지만 비밀이
 * 아니고, BossPickSeoul Vault(kv/bosspickseoul/frontend)와 **키 이름을 같게** 두기 위해
 * `NEXT_PUBLIC_` 접두사를 쓴다. 빌드 시점에 인라인되므로 dev/prod 를 각각 빌드하고,
 * `process.env` 는 반드시 리터럴로 접근한다 (동적 인덱싱은 치환되지 않는다).
 *   dev = https://dev.hondigagae.com / prod = https://www.hondigagae.com
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * 브랜드 에셋 배선 — 아트보드 `혼디가개 브랜드 자산` 5절.
 *
 * **공유 카드만 파일 규약에 맡긴다.** `app/opengraph-image.png` 는 이름만으로 `og:image`
 * 와 `width`/`height`/`type` 까지 방출되고, `twitter:image` 도 Next 가 같은 파일로
 * 채워 준다 — 그래서 트위터용 파일을 따로 두지 않는다.
 *
 * **아이콘은 파일 규약에 맡길 수 없다.** `mask-icon` 은 규약이 없어 `icons` 로 넣어야
 * 하는데, **`metadata.icons` 를 선언하는 순간 `app/icon.*` · `app/apple-icon.*` 자동
 * 감지가 통째로 대체된다.** `icons.other` 만 넣고 빌드했더니 방출된 `<head>` 에
 * `icon.svg` 와 `apple-touch-icon` 링크가 **아예 없었다** (`.next` 산출물 실측).
 * 그래서 넷을 전부 여기서 명시한다.
 *
 * 파일 자체는 `app/` 규약 자리에 그대로 둔다 — 라우트(`/icon.svg` · `/apple-icon.png`)로
 * 서비스되므로 아래 경로가 그 라우트를 가리킨다.
 *
 * `favicon.ico` 는 예외로 **규약이 계속 이긴다** — `metadata.icons` 를 선언해도 자동
 * 방출이 남아서, 여기 또 쓰면 같은 `<link>` 가 두 번 나간다. 그 자동 방출이 `.svg` 보다
 * 먼저 나오므로 아트보드 5절의 ".ico 를 먼저" 요구도 그대로 지켜진다.
 *
 * `sizes` 는 Next 가 `.ico` 를 열어 **가장 큰 항목**으로 적는다(`48x48`). 아트보드는
 * `32x32` 로 적었지만 실제 파일에 든 값이 정본이라 손대지 않는다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '혼디가개',
  description: '반려견과 함께하는 제주 여행을 설계합니다.',
  manifest: '/site.webmanifest',
  icons: {
    /*
      **`favicon.ico` 를 여기에 쓰지 않는다.** `app/favicon.ico` 는 `metadata.icons` 로
      대체되지 않는 특수 케이스라 항상 자동으로 방출되고, 여기 또 쓰면 같은 `<link>` 가
      두 번 나간다 (실측으로 확인했다). 자동 방출이 `.svg` 보다 **먼저** 나가므로
      아트보드 5절의 순서 요구도 그대로 지켜진다.
    */
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    // 180 × 180. 여백은 파일 안에 있고 라운드는 iOS 가 깎는다 (아트보드 3절)
    apple: [{ url: '/apple-icon.png' }],
    /*
      Safari 고정 탭. **단색 실루엣만 허용된다** — 색이나 라운드 사각을 넣으면 사파리가
      통째로 검게 칠한다 (아트보드 3절). `color` 는 사파리가 실루엣에 입히는 색이라
      여기서는 브랜드 컬러가 맞다 — 탭은 우리 UI 밖이다.
    */
    other: [{ rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: MASK_ICON_COLOR }],
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '혼디가개',
    title: '혼디가개',
    /*
      **공유 카드 문구는 매니페스트와 같다.** 남의 타임라인에서 폭 300px 안팎으로 줄어드는
      자리라 한 줄이 전부다 (아트보드 4절). 카드 이미지에 이미 이 문장이 들어가 있어
      다른 문장을 쓰면 그림과 글이 어긋난다.
    */
    description: '제주 반려견 동반 여행 — 날씨와 노면 온도로 오늘 산책을 판정합니다',
    url: SITE_URL,
  },
  /*
    `twitter:image` 를 따로 두지 않는다. 트위터는 `twitter:image` 가 없으면 `og:image` 를
    읽으므로 같은 1200 × 630 을 두 번 실을 이유가 없다. 카드 종류만 알린다.
  */
  twitter: { card: 'summary_large_image' },
}

/**
 * **`theme_color` 는 초록이 아니라 흰색이다** (아트보드 5절). PWA 상태바가 헤더와
 * 이어져야 하는데 헤더 배경이 흰색이라, 초록을 넣으면 상태바만 색 띠로 떠 보인다.
 * `public/site.webmanifest` 의 `theme_color` 와 같은 값이어야 한다.
 */
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {/*
          스크롤바를 구르는 동안에만 드러낸다 (#553). **루트 레이아웃이다** — `(main)` 에
          두면 `(auth)` 그룹 넷이 빠져 로그인 화면만 스크롤바가 상시 보인다.
        */}
        <ScrollbarReveal />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
