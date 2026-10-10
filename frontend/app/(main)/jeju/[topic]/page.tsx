import { notFound } from 'next/navigation'

import type { Metadata } from 'next'

import { JsonLd } from '@/components/json-ld'
import { Canvas } from '@/components/surface'
import { LandingView } from '@/features/landing/landing-view'
import { type PlaceSlice } from '@/lib/api/place'
import { serverFetch } from '@/lib/api/server'
import {
  findLandingTopic,
  LANDING_TOPICS,
  landingCopy,
  landingExplorerHref,
  landingListApiPath,
  landingPath,
  type LandingTopic,
  parseLandingCursor,
} from '@/lib/landing/topics'
import { messages } from '@/lib/messages'
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/json-ld'
import { pageMetadata } from '@/lib/seo/page-metadata'
import { SITE_NAME, siteUrl } from '@/lib/seo/site'

/**
 * 검색어 랜딩 — `/jeju/[topic]` (#1134). 정본 `docs/features/landing/검색랜딩-세부명세.md`.
 *
 * **공개 경로다** — `proxy.ts` 매처에 넣지 않는다.
 *
 * **`loading.tsx` 를 두지 않는다.** 경계가 있으면 응답이 먼저 스트리밍돼, 모르는 주제의
 * `notFound()` 가 200 으로 나간다(soft 404 · `architecture-guide.md` §7). 5xx 도 같은 이유로
 * 던져서 `error.tsx` 가 받게 한다 — 상태 코드가 500 이라야 크롤러가 오류 화면을 색인하지 않는다.
 */
type Params = Promise<{ topic: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}): Promise<Metadata> {
  const topic = findLandingTopic((await params).topic)
  if (topic === null) return {}

  const copy = landingCopy(topic)
  const after = parseLandingCursor((await searchParams).after)

  // 다음 페이지는 다른 장소들이라 자기 주소가 정규 주소다 (명세 D3)
  return pageMetadata({
    title: `${copy.title} · ${SITE_NAME}`,
    description: copy.description,
    path: landingPath(topic, after),
  })
}

export default async function LandingPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const topic = findLandingTopic((await params).topic)
  if (topic === null) notFound()

  const after = parseLandingCursor((await searchParams).after)
  const copy = landingCopy(topic)

  // 실패하면 던진다 — 머리주석. `retry` 가 없는 단건 조회라 블로킹 백오프도 없다
  const slice = await serverFetch<PlaceSlice>(landingListApiPath(topic, after))
  const last = slice.contents.at(-1)?.placeId ?? null
  const base = siteUrl()

  return (
    <Canvas as="main" id="main-content">
      <JsonLd
        data={[
          breadcrumbJsonLd(
            [
              { name: SITE_NAME, path: '/' },
              { name: copy.heading, path: landingPath(topic) },
            ],
            base,
          ),
          itemListJsonLd(
            slice.contents.map((place) => ({
              name: place.title,
              path: `/places/${place.placeId}`,
            })),
            base,
          ),
        ]}
      />
      <LandingView
        heading={copy.heading}
        intro={copy.intro}
        places={slice.contents}
        nextHref={slice.hasNext && last !== null ? landingPath(topic, last) : null}
        firstHref={after === null ? null : landingPath(topic)}
        explorerHref={landingExplorerHref(topic)}
        related={relatedLinks(topic)}
      />
    </Canvas>
  )
}

/** 다른 랜딩 · 올레 · 병원 — 검색으로 들어온 사람의 다음 질문 */
function relatedLinks(current: LandingTopic) {
  return [
    ...LANDING_TOPICS.filter((topic) => topic.slug !== current.slug).map((topic) => ({
      href: landingPath(topic),
      label: landingCopy(topic).heading,
    })),
    { href: '/olle', label: messages.landing.relatedWalkCourses },
    { href: '/emergency', label: messages.landing.relatedEmergency },
  ]
}
