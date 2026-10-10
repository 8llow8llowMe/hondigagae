import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { JsonLd } from '@/components/json-ld'
import {
  breadcrumbJsonLd,
  JSON_LD_IMAGE_LIMIT,
  placeJsonLd,
  serializeJsonLd,
  siteJsonLd,
  walkCourseJsonLd,
} from '@/lib/seo/json-ld'
import { PRODUCTION_SITE_URL } from '@/lib/seo/site'
import { placeDetail } from '@/test/fixtures/place'
import { WALK_COURSE_WITH_COORDS, walkCourseDetail } from '@/test/fixtures/walk-course'
import type { EnumMetadata } from '@/types/api'

const base = PRODUCTION_SITE_URL
const allowance = (code: string): EnumMetadata => ({ code, name: '이름' })

describe('siteJsonLd', () => {
  it('WebSite 와 Organization 을 절대 주소로', () => {
    const [site, org] = siteJsonLd(base)

    expect(site).toMatchObject({
      '@type': 'WebSite',
      name: '혼디가개',
      url: 'https://www.hondigagae.com/',
    })
    expect(org).toMatchObject({
      '@type': 'Organization',
      logo: 'https://www.hondigagae.com/icon-512.png',
    })
  })
})

describe('breadcrumbJsonLd', () => {
  it('순서대로 position 1부터, item 은 절대 주소', () => {
    const crumbs = breadcrumbJsonLd(
      [
        { name: '혼디가개', path: '/' },
        { name: '장소 찾기', path: '/places' },
      ],
      base,
    )

    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: '혼디가개', item: 'https://www.hondigagae.com/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: '장소 찾기',
        item: 'https://www.hondigagae.com/places',
      },
    ])
  })
})

describe('placeJsonLd', () => {
  it('문화시설은 TouristAttraction — 이름 · 주소 · 좌표 · 전화 · https 사진', () => {
    const data = placeJsonLd(placeDetail, base)

    expect(data).toMatchObject({
      '@type': 'TouristAttraction',
      name: placeDetail.title,
      url: `https://www.hondigagae.com/places/${placeDetail.placeId}`,
      address: {
        streetAddress: '제주특별자치도 제주시 한림읍 용금로 906-107 (용금로)',
        postalCode: '63546',
      },
      geo: { latitude: placeDetail.lat, longitude: placeDetail.lng },
      telephone: '064-710-4150',
      image: ['https://tong.visitkorea.or.kr/cms/resource/mock/place-1.jpg'],
    })
  })

  it('숙박은 LodgingBusiness + petsAllowed', () => {
    const data = placeJsonLd(
      {
        ...placeDetail,
        contentType: { code: 'LODGING', name: '숙박' },
        petAllowanceType: allowance('ALLOWED'),
      },
      base,
    )

    expect(data['@type']).toBe('LodgingBusiness')
    expect(data.petsAllowed).toBe(true)
  })

  it('숙박이 아니면 petsAllowed 없이 amenityFeature 로 말한다', () => {
    const data = placeJsonLd({ ...placeDetail, petAllowanceType: allowance('NOT_ALLOWED') }, base)

    expect(data).not.toHaveProperty('petsAllowed')
    expect(data.amenityFeature).toMatchObject({ name: '반려견 동반', value: false })
  })

  it('동반 정보가 없으면 동반 속성을 싣지 않는다 — 모르는 것을 거짓으로 말하지 않는다', () => {
    const data = placeJsonLd(
      {
        ...placeDetail,
        contentType: { code: 'LODGING', name: '숙박' },
        petAllowanceType: allowance('UNKNOWN'),
      },
      base,
    )

    expect(data).not.toHaveProperty('petsAllowed')
    expect(data).not.toHaveProperty('amenityFeature')
  })

  /*
    Event 는 startDate 가 필수다 — 장소 상세에는 기간이 없어 Search Console 이 오류로 센다.
  */
  it('축제도 Event 가 아니라 TouristAttraction', () => {
    expect(
      placeJsonLd({ ...placeDetail, contentType: { code: 'FESTIVAL', name: '축제' } }, base)[
        '@type'
      ],
    ).toBe('TouristAttraction')
  })

  it('사진은 중복을 빼고 앞에서 JSON_LD_IMAGE_LIMIT 장까지', () => {
    const images = Array.from({ length: 9 }, (_, index) => ({
      ...placeDetail.images[0]!,
      originImgUrl: `https://tong.visitkorea.or.kr/${index}.jpg`,
    }))
    const data = placeJsonLd(
      { ...placeDetail, firstImage: 'https://tong.visitkorea.or.kr/0.jpg', images },
      base,
    )

    expect(data.image).toHaveLength(JSON_LD_IMAGE_LIMIT)
    expect((data.image as string[])[1]).toBe('https://tong.visitkorea.or.kr/1.jpg')
  })

  it('좌표·주소·사진이 없으면 그 키를 두지 않는다', () => {
    const data = placeJsonLd(
      {
        ...placeDetail,
        lat: null,
        lng: null,
        addr1: null,
        addr2: null,
        firstImage: null,
        images: [],
        tel: null,
      },
      base,
    )

    for (const key of ['geo', 'address', 'image', 'telephone']) expect(data).not.toHaveProperty(key)
  })
})

describe('walkCourseJsonLd', () => {
  it('시작점 좌표와 코스 이름', () => {
    const data = walkCourseJsonLd(walkCourseDetail(WALK_COURSE_WITH_COORDS), base)

    expect(data).toMatchObject({
      '@type': 'TouristAttraction',
      name: `제주올레 ${WALK_COURSE_WITH_COORDS.courseLabel} ${WALK_COURSE_WITH_COORDS.name}`,
      geo: { latitude: WALK_COURSE_WITH_COORDS.lat, longitude: WALK_COURSE_WITH_COORDS.lng },
    })
  })
})

describe('JsonLd <script>', () => {
  it('application/ld+json 으로 내보내고 따옴표를 HTML 이스케이프하지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(JsonLd, { data: { name: '수월봉' } }))

    expect(markup).toBe('<script type="application/ld+json">{"name":"수월봉"}</script>')
  })

  it('값 안의 </script> 가 태그를 닫지 못한다', () => {
    const serialized = serializeJsonLd({ name: '</script><script>alert(1)</script>' })

    expect(serialized).not.toContain('</script>')
    expect(JSON.parse(serialized)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})
