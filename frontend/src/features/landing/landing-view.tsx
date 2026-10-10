import Link from 'next/link'

import { EmptyState } from '@/components/empty-state'
import { Surface, SurfaceList, SurfaceStack } from '@/components/surface'
import { PLACE_PRIORITY_ROW_COUNT } from '@/features/place/place-list-section'
import { PlaceRow } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlaceSummary } from '@/types/place'

/** 링크 하나 — 랜딩 안 모든 텍스트 링크가 같은 모양·높이 44 를 쓴다 */
const LINK_CLASS =
  'text-body-2 text-link hover:text-link-hover focus-visible:ring-brand-500 inline-flex min-h-11 items-center font-semibold focus-visible:ring-2 focus-visible:outline-none'

export type LandingLink = { href: string; label: string }

export type LandingViewProps = {
  heading: string
  intro: readonly string[]
  places: readonly PlaceSummary[]
  /** 다음 페이지 주소. 마지막 페이지면 `null` */
  nextHref: string | null
  /** 첫 페이지가 아니면 첫 페이지 주소 — "처음부터 보기" */
  firstHref: string | null
  explorerHref: string
  related: readonly LandingLink[]
}

/**
 * 검색어 랜딩 — `/jeju/[topic]` (#1134). 정본 `docs/features/landing/검색랜딩-세부명세.md`.
 *
 * **props 만 받는 서버 컴포넌트다.** 조회는 라우트가 하고 여기는 그리기만 한다 — 테스트가
 * `renderToStaticMarkup` 으로 이 파일을 통째로 본다 (`testing-guide.md` §1).
 *
 * **보이는 `h1` 을 둔다.** 다른 목록 화면은 `sr-only` `h1` 이지만, 이 화면은 검색어 그대로의
 * 제목이 곧 내용이다 — 검색으로 들어온 사람이 "맞게 왔다" 를 첫 줄에서 확인한다.
 *
 * **행은 `PlaceRow` 그대로다.** `/places` 목록과 같은 행이라 랜딩에서 본 장소가 목록에서도
 * 같은 모양으로 보인다. 앞 몇 행만 먼저 받는 수(`PLACE_PRIORITY_ROW_COUNT`, #1132)도 목록과 같다.
 */
export function LandingView({
  heading,
  intro,
  places,
  nextHref,
  firstHref,
  explorerHref,
  related,
}: LandingViewProps) {
  const copy = messages.landing

  return (
    <SurfaceStack className="content-container">
      <Surface>
        <div className={cn('flex flex-col gap-3 py-5 md:py-6', INSET_CLASS.card)}>
          <h1 className="text-title-1 text-fg font-bold break-keep">{heading}</h1>
          {intro.map((paragraph) => (
            <p key={paragraph} className="text-body-2 text-fg-muted break-keep">
              {paragraph}
            </p>
          ))}
          <Link href={explorerHref} className={LINK_CLASS}>
            {copy.explorerLink} ›
          </Link>
        </div>
      </Surface>

      <Surface title={copy.listTitle} titleId="landing-list-heading" description={copy.listSource}>
        {places.length === 0 ? (
          <EmptyState
            headingLevel={3}
            inset="card"
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            action={
              firstHref === null ? undefined : (
                <Link href={firstHref} className={LINK_CLASS}>
                  {copy.firstPage} ›
                </Link>
              )
            }
          />
        ) : (
          <SurfaceList aria-label={copy.listTitle}>
            {places.map((place, index) => (
              <PlaceRow
                key={place.placeId}
                place={place}
                priority={index < PLACE_PRIORITY_ROW_COUNT}
              />
            ))}
          </SurfaceList>
        )}

        {/*
          **페이지는 `<a href>` 다** — 무한 스크롤이 아니다. 크롤러는 스크롤하지 않으니 다음
          페이지가 링크로 있어야 끝까지 읽는다 (명세 D3).
        */}
        {(nextHref !== null || (firstHref !== null && places.length > 0)) && (
          <nav
            aria-label={copy.listTitle}
            className={cn('border-border flex flex-wrap gap-x-6 border-t py-2', INSET_CLASS.card)}
          >
            {firstHref !== null && places.length > 0 && (
              <Link href={firstHref} className={LINK_CLASS}>
                {copy.firstPage}
              </Link>
            )}
            {nextHref !== null && (
              <Link href={nextHref} className={LINK_CLASS}>
                {copy.nextPage} ›
              </Link>
            )}
          </nav>
        )}
      </Surface>

      <Surface title={copy.faqTitle} titleId="landing-faq-heading">
        <dl className={cn('flex flex-col gap-4 pb-5', INSET_CLASS.card)}>
          {copy.faq.map((item) => (
            <div key={item.question} className="flex flex-col gap-1">
              <dt className="text-body-1 text-fg font-semibold break-keep">{item.question}</dt>
              <dd className="text-body-2 text-fg-muted break-keep">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      <Surface title={copy.relatedTitle} titleId="landing-related-heading">
        <ul className={cn('flex flex-col pb-3', INSET_CLASS.card)}>
          {related.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={LINK_CLASS}>
                {link.label} ›
              </Link>
            </li>
          ))}
        </ul>
      </Surface>
    </SurfaceStack>
  )
}
