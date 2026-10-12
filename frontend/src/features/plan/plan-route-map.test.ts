import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlanRouteMap } from '@/features/plan/plan-route-map'
import { toRouteModel } from '@/lib/map/route'

describe('PlanRouteMap', () => {
  it('정류점이 없으면 아무것도 그리지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanRouteMap, {
        model: toRouteModel({ items: [], lodgingBasis: null }),
        day: 1,
        onFailure: () => undefined,
      }),
    )
    expect(markup).toBe('')
  })
})
