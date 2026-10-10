import Link from 'next/link'

import { Wordmark } from '@/components/brand/wordmark'
import { LANDING_TOPICS, landingCopy, landingPath } from '@/lib/landing/topics'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 전역 푸터 — 이슈 #399.
 *
 * **서버 컴포넌트다.** 상태도 세션 분기도 없다.
 *
 * **이 푸터의 존재 이유는 데이터 출처 표기다.** 공모전 출품물이고 화면 곳곳이 공공데이터를
 * 쓰는데 그 사실이 개별 캡션으로만 흩어져 있었다 (`messages/footer.ts` 주석).
 *
 * **바(`<footer>`)는 전폭이고 안쪽 div 만 캡한다** — 헤더와 같은 구조다 (#376). 캡을
 * 바에 걸면 `border-t` 가 화면 가운데서 끊긴다. 좌우 인셋은 `INSET_CLASS.main` 을
 * 참조한다 (#386 · #393) — 문자열을 다시 적지 않는다.
 *
 * **지도가 뷰포트를 꽉 채우는 화면에는 나오지 않는다.** `app/globals.css` 의
 * `body:has(.map-canvas-height) .site-footer` 가 감춘다 — 그 화면은 `100dvh` 라 푸터가
 * 붙으면 지도 화면에 페이지 스크롤이 생긴다. **레이아웃이 화면마다 분기하지 않고**
 * 지도 쪽이 자기 성질(전폭 지도 클래스)로 빠지는 방식이다 — `.rail-layout` 에 가입하지
 * 않는 것으로 전폭을 표현하는 #376 의 설계와 같은 축이다.
 *
 * **768 미만에는 나오지 않는다 — 거기엔 하단 탭바가 있다.** 탭바 위에 푸터가 또 붙으면
 * 내비게이션이 두 겹으로 읽힌다. 경계는 `md` 하나뿐이다 — 탭바가 `md:hidden` 이라
 * **태블릿에는 이미 탭바가 없고**, "모바일이냐 태블릿이냐" 로 갈리는 규칙을 새로 만들지
 * 않는다. 기준은 늘 탭바가 있는가다.
 *
 * **그래서 `/about` 이 먼저 생겼다.** 이 푸터의 존재 이유가 출처 표기인데 갈 곳 없이
 * 감추면 모바일에서 출처가 통째로 사라진다 — `features/about/about-view.tsx` 가 같은
 * 문구(`messages.footer`)를 읽어 그 자리를 맡고, 모바일은 홈 하단 링크로 거기에 닿는다.
 *
 * **탭바 자리를 비우는 일은 `.page-canvas` 가 물려받았다** — 감춘 요소는 여백도 주지
 * 못한다. `app/globals.css` 의 `.page-canvas` 주석이 그 이유의 정본이다.
 *
 * **없는 링크는 여전히 만들지 않는다.** 규칙은 그대로고 전제만 바뀌었다 — 이용약관·
 * 개인정보 처리방침은 #610 에서 페이지가 생겨 링크를 걸었고, `/about` 도 같은 이유로
 * 단다. **문의는 아직 페이지가 없어 넣지 않는다.**
 *
 * **이 푸터는 768 아래에서 감춰진다** (`app/globals.css`). 그래서 약관 링크가 여기만
 * 있으면 **모바일 방문자는 가입 전에 약관을 읽을 길이 없다** — 마이페이지는 로그인이
 * 필요하고 `(auth)` 그룹에는 푸터가 없다. `/about` 이 그 경로를 함께 맡는 이유다.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer border-border bg-bg border-t">
      {/*
        **좌우 두 줄이다** (#1022). 예전에는 여섯 덩어리가 왼쪽에만 세로로 쌓여 1280 에서도
        오른쪽 절반이 비고 높이가 330 가까이 됐다.

        - 위 줄 — 왼쪽 **브랜드**(워드마크 · 한 줄 소개) | 오른쪽 **데이터 출처**
        - 아래 줄 — 왼쪽 **고지**(한계 안내 · 출품 표기) | 오른쪽 **링크**(약관 · 소개)

        **오른쪽은 끝선에 붙인다.** 두 줄의 오른쪽 덩어리가 같은 세로선에 서야 양쪽으로 읽힌다.
        위 줄만 1024 부터 나눈다 — 768–1023 에서는 한 줄 소개와 출처 다섯 개가 한 줄에 들지
        않는다. 아래 줄은 두 덩어리가 짧아 768 부터 나눈다.
      */}
      <div className={cn('content-container flex flex-col gap-6 py-8', INSET_CLASS.main)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="flex min-w-0 flex-col gap-2">
            {/*
              워드마크는 라이브 텍스트가 아니다 (아트보드 `브랜드 자산` 2절) — 헤더와 같은
              컴포넌트를 쓴다. **심볼은 붙이지 않는다**: 헤더의 락업(#240)은 상시 노출되는
              브랜드 자리의 결정이고, 푸터는 그 자리를 두 번 만들지 않는다.
            */}
            <Wordmark />
            <p className="text-body-2 text-fg-muted">{messages.footer.tagline}</p>
            {/*
              **검색어 랜딩으로 가는 내부 링크** (#1134). 크롤러가 사이트맵 말고도 링크로 닿게
              하고, 데스크톱 사람에게는 "제주 애견동반 숙소" 같은 질문의 바로가기가 된다. 목록은
              `LANDING_TOPICS` 하나를 읽는다 — 라우트·사이트맵과 같은 것이다.
            */}
            <nav aria-label={messages.landing.footerNavLabel}>
              <ul className="flex flex-wrap gap-x-4 gap-y-0">
                {LANDING_TOPICS.map((topic) => (
                  <li key={topic.slug}>
                    <Link
                      href={landingPath(topic)}
                      className="text-caption text-fg-muted hover:text-fg focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-medium focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {landingCopy(topic).linkLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/*
            출처는 목록이다 — `<ul>` 로 둔다. 쉼표로 이은 한 문장으로 쓰면 스크린리더가
            기관 이름 다섯 개를 한 덩어리로 읽는다.

            `gap-x-3` 이 구분 역할을 한다 — 가운뎃점을 문자로 끼우면 그것까지 읽힌다.
          */}
          <div className="flex flex-col gap-1 lg:items-end">
            <h2 className="text-caption text-fg-muted font-semibold">
              {messages.footer.sourcesLabel}
            </h2>
            <ul className="text-caption text-fg-muted flex flex-wrap gap-x-3 gap-y-1 font-medium lg:justify-end">
              {messages.footer.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-border flex flex-col gap-2 border-t pt-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-caption text-fg-muted font-medium">{messages.footer.disclaimer}</p>
            <p className="text-caption text-fg-subtle font-medium">{messages.footer.contest}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4">
            {/*
              **링크 묶음도 목록이다** — 출처 목록과 같은 이유로 `<ul>` 로 둔다. 랜드마크
              이름을 주는 것은 스크린리더 사용자가 푸터 안에서 이 묶음을 골라 들어오기
              위해서다.
            */}
            <nav aria-label={messages.footer.legalLabel}>
              {/*
                링크마다 높이 44 를 준다 (#905 R4) — 옆 `/about` 과 같은 방식이다. 줄바꿈이
                나도 링크 자신이 44 라 줄 사이를 더 벌리지 않는다(`gap-y-0`).
              */}
              <ul className="flex flex-wrap gap-x-4 gap-y-0">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-caption text-fg-muted hover:text-fg focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-medium focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/*
              **약관 옆에 서지만 약관 `nav` 밖이다** — 랜드마크 이름(`약관`)이 이 링크를
              설명하지 않는다. 같은 내용을 읽을 수 있는 화면이 실제로 있어서 단다 — 모바일에는
              이 푸터가 없고 `/about` 이 그 자리를 맡으므로, 데스크톱에서도 그 화면이 어디 있는지
              알려야 한다. **1024 이상 · 비로그인은 헤더에도 같은 링크가 있다** (#964 ·
              `HeaderAboutLink`). 로그인한 사람과 768–1023 에게는 여기가 유일한 통로라 이
              링크를 걷지 않는다.

              높이 44 를 지킨다.
            */}
            <Link
              href="/about"
              className="text-caption text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {messages.about.title}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
