import type { MetadataRoute } from 'next'

import { buildRobots } from '@/lib/seo/robots'
import { siteUrl } from '@/lib/seo/site'

import { PROTECTED_PATHS } from '../proxy'

/** `/robots.txt` (#1130). 규칙은 `lib/seo/robots.ts` 가 갖는다 */
export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl(), PROTECTED_PATHS)
}
