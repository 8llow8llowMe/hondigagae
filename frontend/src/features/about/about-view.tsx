import Link from 'next/link'

import { ChevronRightIcon } from '@/components/icons'
import { Surface, SurfaceList } from '@/components/surface'
import { LEGAL_LINKS } from '@/lib/legal/links'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 서비스 소개 — `/about`.
 *
 * **서버 컴포넌트다.** 상태도 세션 분기도 없고 백엔드를 부르지 않는다.
 *
 * **이 화면이 생긴 이유는 모바일에서 푸터가 빠졌기 때문이다.** 768 미만에는 하단 탭바가
 * 있어 그 위에 푸터가 또 붙으면 내비게이션이 두 겹으로 읽힌다. 그런데 푸터의 존재 이유는
 * 공공데이터 출처 표기(#399)라, 감추기만 하면 **모바일에서 출처가 통째로 사라진다.**
 * 그래서 출처가 갈 곳을 먼저 만들고 푸터를 감춘다.
 *
 * **보호 라우트가 아니다** — `proxy.ts` `PROTECTED_PATHS` 에 넣지 않는다. 출처 표기를
 * 로그인 뒤에 두면 표기하지 않은 것과 같다.
 *
 * **출처 · 면책 · 공모전 표기는 `messages.footer` 를 그대로 읽는다.** 문구를 여기에 다시
 * 적으면 한쪽만 고쳐지고, 그때 같은 데이터의 출처가 데스크톱(푸터)과 모바일(이 화면)에서
 * 다르게 보인다 — 푸터가 원천 기관만 적고 `providerName` 을 대신 짓지 않는 것과 같은 축이다
 * (`messages/footer.ts` 머리 주석).
 *
 * **폭은 `max-w-screen-md` 다** — 읽는 화면이라 레일을 쓰지 않는다. 마이페이지와 같다.
 * 폭을 갖는 것이 `main` 이 아니라 `SurfaceStack` 인 이유는 바닥이 전폭이어야 하기
 * 때문이다 (#453 · #462). 여기서는 페이지 쪽이 `Canvas` 와 `SurfaceStack` 을 그린다.
 *
 * **약관 링크도 같은 이유로 여기 있다** (#610). 푸터가 감춰지는 768 미만에서 마이페이지는
 * 로그인이 필요하고 `(auth)` 그룹에는 푸터가 없어, 이 화면이 없으면 **가입 전 모바일
 * 방문자가 약관을 읽을 수단이 사라진다.** 출처와 같은 구조의 문제다.
 */
export function AboutView() {
  return (
    <>
      {/*
        **보이는 제목은 첫 카드의 `h2` 다** (§0 "섹션 제목은 섹션 안에 있다"). 마이페이지 ·
        장소 목록(#439) · 반려견(#464)과 같다 — 밖에 두면 제목만 바닥 위에 떠 어느 묶음의
        제목인지 모호해진다.
      */}
      <h1 className="sr-only">{messages.about.title}</h1>

      <Surface
        lead
        titleId="about-heading"
        title={messages.about.introTitle}
        description={messages.footer.tagline}
      >
        <div className={cn('flex flex-col gap-2 pb-5', INSET_CLASS.card)}>
          {messages.about.intro.map((line) => (
            <p key={line} className="text-body-2 text-fg-muted">
              {line}
            </p>
          ))}
        </div>
      </Surface>

      <Surface
        titleId="about-sources-heading"
        title={messages.footer.sourcesLabel}
        description={messages.about.sourcesDescription}
      >
        {/*
          **푸터와 같은 `<ul>` 구조다.** 쉼표로 이은 한 문장으로 쓰면 스크린리더가 기관
          이름 다섯 개를 한 덩어리로 읽는다. 다만 푸터는 한 줄에 흘리고(`flex-wrap`) 여기는
          세로로 쌓는다 — 이 화면은 출처가 주인공이라 훑지 않고 읽는다.
        */}
        <ul className={cn('flex flex-col gap-1 pb-5', INSET_CLASS.card)}>
          {messages.footer.sources.map((source) => (
            <li key={source} className="text-body-2 text-fg-muted font-medium">
              {source}
            </li>
          ))}
        </ul>
      </Surface>

      <Surface titleId="about-notice-heading" title={messages.about.noticeTitle}>
        <div className={cn('flex flex-col gap-2 pb-5', INSET_CLASS.card)}>
          <p className="text-body-2 text-fg-muted">{messages.footer.disclaimer}</p>
          <p className="text-caption text-fg-subtle font-medium">{messages.footer.contest}</p>
        </div>
      </Surface>

      {/*
        **이동 항목이라 `SurfaceList` 다** — 마이페이지 계정 섹션과 같은 모양을 쓴다
        (`account-section.tsx`). 같은 역할의 행이 화면마다 다르게 생기지 않게 한다.
      */}
      <Surface
        titleId="about-legal-heading"
        title={messages.about.legalTitle}
        description={messages.about.legalDescription}
      >
        <SurfaceList>
          {LEGAL_LINKS.map((link) => (
            <li key={link.href} className={INSET_CLASS.card}>
              <Link
                href={link.href}
                className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
              >
                <span className="text-body-1 text-fg flex-1">{link.label}</span>
                <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
              </Link>
            </li>
          ))}
        </SurfaceList>
      </Surface>
    </>
  )
}
