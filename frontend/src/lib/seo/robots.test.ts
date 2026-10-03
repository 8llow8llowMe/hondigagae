import { describe, expect, it } from 'vitest'

import { buildRobots } from '@/lib/seo/robots'
import { PRODUCTION_SITE_URL } from '@/lib/seo/site'

import { PROTECTED_PATHS } from '../../../proxy'

function rulesOf(robots: ReturnType<typeof buildRobots>) {
  const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules
  if (rules === undefined) throw new Error('rules 가 비었다')
  return { allow: [rules.allow ?? []].flat(), disallow: [rules.disallow ?? []].flat() }
}

describe('buildRobots — #1130', () => {
  it('운영이 아니면 전부 막고 사이트맵을 알리지 않는다', () => {
    const robots = buildRobots('https://dev.hondigagae.com', PROTECTED_PATHS)

    expect(rulesOf(robots).disallow).toEqual(['/'])
    expect(robots.sitemap).toBeUndefined()
  })

  it('운영은 열고 사이트맵 절대 주소를 알린다', () => {
    const robots = buildRobots(PRODUCTION_SITE_URL, PROTECTED_PATHS)

    expect(rulesOf(robots).allow).toEqual(['/'])
    expect(robots.sitemap).toBe('https://www.hondigagae.com/sitemap.xml')
  })

  it('보호 경로 전부와 BFF·소셜 착지점을 막는다 — proxy.ts 의 목록 그대로', () => {
    const { disallow } = rulesOf(buildRobots(PRODUCTION_SITE_URL, PROTECTED_PATHS))

    expect(PROTECTED_PATHS.length).toBeGreaterThan(0)
    for (const path of PROTECTED_PATHS) expect(disallow).toContain(path)
    expect(disallow).toEqual(expect.arrayContaining(['/api/', '/oauth/']))
  })

  /*
    막으면 크롤러가 화면을 못 읽어 그 안의 noindex 도 못 본다 — 외부 링크만으로 주소가
    검색 결과에 남는다. 이 화면들은 메타 robots 로 끈다.
  */
  it.each(['/login', '/signup', '/shared-plans', '/places', '/olle', '/emergency', '/about'])(
    '%s 는 막지 않는다',
    (path) => {
      const { disallow } = rulesOf(buildRobots(PRODUCTION_SITE_URL, PROTECTED_PATHS))
      expect(disallow.some((rule) => path.startsWith(rule) && rule !== '/')).toBe(false)
    },
  )
})
