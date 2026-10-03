import { messages } from '@/lib/messages'
import { shortAddress } from '@/lib/place/address'
import { toPlainText } from '@/lib/place/text'
import { SITE_NAME } from '@/lib/seo/site'
import type { EnumMetadata } from '@/types/api'
import type { PetAllowanceCode, PlaceDetail } from '@/types/place'

/**
 * 장소 상세의 검색 노출 판단 (#1130).
 *
 * **동반 정보가 있는 곳만 색인한다.** 2,323곳 중 1,685곳(73%)이 `UNKNOWN` 이라 화면이
 * "동반 정보 없음" 을 말한다(2026-10-03 dev 전수). "제주 + 반려견" 검색에 답하지 못하는 페이지가
 * 다수면 검색엔진이 사이트 전체의 품질을 낮게 본다. `NOT_ALLOWED` 는 남긴다 — "○○ 강아지 출입"
 * 검색에 "안 된다" 는 분명한 답이다.
 *
 * **사이트맵과 상세 `robots` 가 이 목록 하나를 쓴다.** 둘이 갈리면 사이트맵에 올린 주소가
 * `noindex` 로 답해 Search Console 이 오류로 센다.
 */
export const INDEXABLE_PET_ALLOWANCES = [
  'ALLOWED',
  'PARTIALLY_ALLOWED',
  'NOT_ALLOWED',
] as const satisfies readonly PetAllowanceCode[]

const INDEXABLE = new Set<string>(INDEXABLE_PET_ALLOWANCES)

/** 원천에서 사라진 장소(`delisted`)도 색인하지 않는다 — 없어진 곳을 검색에 내보내지 않는다 */
export function isIndexablePlace(
  place: Pick<PlaceDetail, 'petAllowanceType' | 'delisted'>,
): boolean {
  return !place.delisted && INDEXABLE.has(place.petAllowanceType.code)
}

/** 동반 정보가 있으면 서버 이름(`동반 가능` · `부분 동반 가능` · `동반 불가`)을 그대로 쓴다 */
function knownName(metadata: EnumMetadata | null | undefined): string | null {
  if (metadata === null || metadata === undefined || metadata.code === 'UNKNOWN') return null
  return metadata.name
}

/**
 * `<title>`. 예) `수월봉 반려견 동반 가능 · 혼디가개`.
 *
 * 사람들이 실제로 치는 말이 `{장소명} 강아지` · `{장소명} 반려견 동반` 이다. 동반 정보가 없으면
 * 장소명만 쓴다 — `정보 없음` 을 제목에 박으면 검색 결과에서 그 말만 읽힌다.
 */
export function placeSeoTitle(place: Pick<PlaceDetail, 'title' | 'petAllowanceType'>): string {
  const allowance = knownName(place.petAllowanceType)
  const head =
    allowance === null ? place.title : `${place.title} ${messages.seo.petPrefix} ${allowance}`

  return `${head} · ${SITE_NAME}`
}

export const PLACE_DESCRIPTION_LIMIT = 150

/**
 * 이보다 짧은 개요는 싣지 않는다. 원문 개요가 `관광지` · `박물관` 처럼 **분류어 한 단어**인
 * 곳이 있다(dev `/places/126434` 실측) — 붙이면 `… · 관광지 · 제주시 한경면. 관광지` 가 된다.
 */
export const PLACE_OVERVIEW_MIN_LENGTH = 20

/**
 * `<meta name="description">`. 예) `반려견 부분 동반 가능 · 전 견종 가능 · 관광지 · 제주시 한경면. 개요…`
 *
 * **동반 조건으로 시작한다.** 개요는 TourAPI 원문이라 visitkorea 와 같은 글이고, 검색 결과에서
 * 이 서비스만의 정보는 동반 조건이다. 예전에는 주소만 나간 곳이 많았다
 * (`제주특별자치도 제주시 조천읍 516로 1865`).
 */
export function placeSeoDescription(
  place: Pick<PlaceDetail, 'petAllowanceType' | 'petInfo' | 'contentType' | 'addr1' | 'overview'>,
): string {
  const allowance = knownName(place.petAllowanceType)
  const facts = [
    allowance === null ? null : `${messages.seo.petPrefix} ${allowance}`,
    knownName(place.petInfo?.allowedPetSize),
    place.contentType.name,
    shortAddress(place.addr1),
  ].filter((part): part is string => part !== null && part !== '')

  const lead = facts.join(' · ')
  const overview = toPlainText(place.overview)?.replace(/\s+/g, ' ') ?? null
  const text =
    overview === null || overview.length < PLACE_OVERVIEW_MIN_LENGTH ? lead : `${lead}. ${overview}`
  const single = text === '' ? messages.seo.placesDescription : text

  return single.length <= PLACE_DESCRIPTION_LIMIT
    ? single
    : `${single.slice(0, PLACE_DESCRIPTION_LIMIT)}…`
}
