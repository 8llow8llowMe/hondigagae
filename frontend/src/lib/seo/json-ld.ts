import { messages } from '@/lib/messages'
import { placeSeoDescription } from '@/lib/seo/place'
import { absoluteUrl, SITE_NAME } from '@/lib/seo/site'
import { walkCourseSeoDescription } from '@/lib/seo/walk-course'
import type { PlaceDetail } from '@/types/place'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * 구조화 데이터(JSON-LD) 조립 (#1131).
 *
 * **순위를 직접 올리는 장치가 아니다.** 검색엔진이 장소를 "관광지 · 숙소 · 음식점" 이라는
 * 엔터티로, 페이지 위치를 브레드크럼으로 이해하게 한다 — 브레드크럼은 구글 검색 결과의 URL 줄을
 * `혼디가개 › 장소 찾기 › 수월봉` 으로 바꾼다.
 *
 * **화면에 보이는 사실만 싣는다.** 구글 지침이 "페이지에 없는 내용을 마크업하지 말 것" 이다.
 * 그래서 점수·혼잡처럼 클라이언트가 나중에 그리는 값은 넣지 않는다.
 *
 * 값은 전부 **평범한 객체**다. `<script>` 로 내보내는 일은 `components/json-ld.tsx` 가 한다.
 */
export type JsonLd = Record<string, unknown>

const CONTEXT = 'https://schema.org'

/** 홈 — 사이트 이름(검색 결과의 사이트 이름 줄)과 운영 주체 */
export function siteJsonLd(base: string): JsonLd[] {
  const url = absoluteUrl('/', base)

  return [
    { '@context': CONTEXT, '@type': 'WebSite', name: SITE_NAME, url, inLanguage: 'ko-KR' },
    {
      '@context': CONTEXT,
      '@type': 'Organization',
      name: SITE_NAME,
      url,
      logo: absoluteUrl('/icon-512.png', base),
    },
  ]
}

export type BreadcrumbItem = { name: string; path: string }

export function breadcrumbJsonLd(items: BreadcrumbItem[], base: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, base),
    })),
  }
}

/**
 * 목록 페이지(검색어 랜딩, #1134)의 항목. 각 항목은 상세 페이지 주소만 가리킨다 — 구글의
 * "요약 페이지 + 별도 상세 페이지" 모양이다.
 */
export function itemListJsonLd(items: BreadcrumbItem[], base: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path, base),
    })),
  }
}

/**
 * 콘텐츠 타입 코드 → schema.org 타입. **화면 문구가 아니라 어휘 대응이다** — 서버 enum 의
 * `name` 을 한국어로 다시 쓰는 매핑 테이블이 아니다.
 *
 * 축제(`FESTIVAL`)를 `Event` 로 두지 않는다. `Event` 는 `startDate` 가 필수인데 장소 상세에는
 * 기간이 없다 — 필수 속성이 빠진 마크업은 Search Console 이 오류로 센다.
 */
const PLACE_TYPES: Record<string, string> = {
  LODGING: 'LodgingBusiness',
  RESTAURANT: 'Restaurant',
  SHOPPING: 'Store',
}
const DEFAULT_PLACE_TYPE = 'TouristAttraction'

/** 사진은 앞에서 몇 장만 — 갤러리 전체(최대 수십 장)를 싣으면 HTML 만 무거워진다 */
export const JSON_LD_IMAGE_LIMIT = 5

/** 동반 여부를 참·거짓으로 말할 수 있을 때만 값이 있다 */
function petsAllowed(code: string): boolean | null {
  if (code === 'ALLOWED' || code === 'PARTIALLY_ALLOWED') return true
  if (code === 'NOT_ALLOWED') return false
  return null
}

function toHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}

export function placeJsonLd(place: PlaceDetail, base: string): JsonLd {
  const type = PLACE_TYPES[place.contentType.code] ?? DEFAULT_PLACE_TYPE
  const allowed = petsAllowed(place.petAllowanceType.code)
  const images = [place.firstImage, ...place.images.map((image) => image.originImgUrl)]
    .filter((url): url is string => url !== null && url !== '')
    .map(toHttps)
  const streetAddress = [place.addr1, place.addr2].filter(Boolean).join(' ')

  return {
    '@context': CONTEXT,
    '@type': type,
    name: place.title,
    url: absoluteUrl(`/places/${place.placeId}`, base),
    description: placeSeoDescription(place),
    ...(images.length > 0 && { image: [...new Set(images)].slice(0, JSON_LD_IMAGE_LIMIT) }),
    ...(streetAddress !== '' && {
      address: {
        '@type': 'PostalAddress',
        streetAddress,
        ...(place.zipcode && { postalCode: place.zipcode }),
        addressCountry: 'KR',
      },
    }),
    ...(place.lat !== null &&
      place.lng !== null && {
        geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng },
      }),
    ...(place.tel && { telephone: place.tel }),
    ...(allowed !== null && {
      /*
        `petsAllowed` 는 schema.org 에서 숙박(`LodgingBusiness`) 등에만 정의된 속성이다.
        나머지 타입은 `Place` 가 가진 `amenityFeature` 로 같은 사실을 말한다.
      */
      ...(type === 'LodgingBusiness' && { petsAllowed: allowed }),
      amenityFeature: {
        '@type': 'LocationFeatureSpecification',
        name: messages.seo.petFeatureName,
        value: allowed,
      },
    }),
  }
}

/**
 * 올레 코스 — `TouristAttraction`. 좌표는 **시작점**이다 (`WalkCourseSummary.lat/lng`).
 * 거리·걷는 시간은 schema.org 에 맞는 속성이 없어 설명 문장에 싣는다.
 */
export function walkCourseJsonLd(course: WalkCourseDetail, base: string): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': DEFAULT_PLACE_TYPE,
    name: `${messages.seo.walkCourseLabelPrefix} ${course.courseLabel} ${course.name}`,
    url: absoluteUrl(`/olle/${course.walkCourseId}`, base),
    description: walkCourseSeoDescription(course),
    ...(course.firstImage && { image: [toHttps(course.firstImage)] }),
    ...(course.lat !== null &&
      course.lng !== null && {
        geo: { '@type': 'GeoCoordinates', latitude: course.lat, longitude: course.lng },
      }),
  }
}

/** `<script>` 본문. `<` 를 이스케이프해 문자열 값이 `</script>` 로 태그를 닫지 못하게 한다 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
