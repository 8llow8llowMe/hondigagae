import { paths } from '@/lib/api/paths'
import { messages } from '@/lib/messages'
import { isPlaceId } from '@/lib/place/place-id'
import { DEFAULT_PLACE_FILTERS, toPlaceApiQuery, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { PLACES_DEFAULT_VIEW, viewModeHref } from '@/lib/url/view-mode'
import type { ContentTypeCode, PlaceFilters } from '@/types/place'

/**
 * 검색어 랜딩 주제 (#1134). 정본은 `docs/features/landing/검색랜딩-세부명세.md` D0.
 *
 * **라우트 · 사이트맵 · 푸터가 이 목록 하나를 읽는다.** 주제를 더할 때 한 곳만 고치면 세 곳이
 * 같이 바뀐다 — 사이트맵에 빠진 랜딩은 크롤러가 찾기 어렵고, 링크만 있고 라우트가 없으면 404 다.
 */
export const LANDING_TOPICS = [
  { slug: 'pet-friendly-stays', copy: 'stays', contentType: 'LODGING' },
  { slug: 'pet-friendly-places', copy: 'places', contentType: 'TOURIST_SPOT' },
  { slug: 'pet-friendly-restaurants', copy: 'restaurants', contentType: 'RESTAURANT' },
] as const satisfies readonly {
  slug: string
  copy: keyof typeof messages.landing.topics
  contentType: ContentTypeCode
}[]

export type LandingTopic = (typeof LANDING_TOPICS)[number]

/** 백엔드 `@Max(50)`. 랜딩은 한 페이지에 많이 보여 줄수록 검색어에 답이 된다 */
export const LANDING_PAGE_SIZE = 50

export function findLandingTopic(slug: string): LandingTopic | null {
  return LANDING_TOPICS.find((topic) => topic.slug === slug) ?? null
}

export function landingCopy(topic: LandingTopic) {
  return messages.landing.topics[topic.copy]
}

/** **`ALLOWED` 만** — 명세 D0 · D8 */
export function landingFilters(topic: LandingTopic): PlaceFilters {
  return { ...DEFAULT_PLACE_FILTERS, contentType: topic.contentType, petAllowanceType: 'ALLOWED' }
}

export function landingListApiPath(topic: LandingTopic, after: string | null): string {
  return paths.places.list(toPlaceApiQuery(landingFilters(topic), after, LANDING_PAGE_SIZE))
}

/** 화면 주소. `after` 가 있으면 다음 페이지 */
export function landingPath(topic: LandingTopic, after: string | null = null): string {
  const base = `/jeju/${topic.slug}`
  return after === null ? base : `${base}?after=${encodeURIComponent(after)}`
}

/** 쿼리의 `after`. 장소 id 모양이 아니면 첫 페이지로 본다 — 백엔드에 400 을 묻지 않는다 */
export function parseLandingCursor(raw: string | string[] | undefined): string | null {
  return typeof raw === 'string' && isPlaceId(raw) ? raw : null
}

/** 같은 조건을 `/places` 목록으로 연다 — 지역·크기 같은 조건을 더 걸고 싶은 사람에게 */
export function landingExplorerHref(topic: LandingTopic): string {
  return viewModeHref(
    '/places',
    toPlaceFilterQuery(landingFilters(topic)),
    'list',
    PLACES_DEFAULT_VIEW,
  )
}
