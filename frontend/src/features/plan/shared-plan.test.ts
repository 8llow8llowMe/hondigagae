import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SharedPlanExpired } from '@/features/plan/shared-plan-expired'
import { SharedPlanNotFound } from '@/features/plan/shared-plan-not-found'
import { SharedPlanSection } from '@/features/plan/shared-plan-section'
import { messages } from '@/lib/messages'
import type { SharedPlan } from '@/types/plan'

/**
 * 공유 열람 화면의 갈래를 잠근다 (#628).
 *
 * **핵심은 404 와 410 이 다른 말을 한다는 것**이다 — 백엔드가 둘을 가른 이유가 거기
 * 있고(받은 사람이 할 수 있는 일이 있는 갈래는 만료뿐이다), 합쳐지면 조용히 회귀한다.
 *
 * **응답에 없는 값의 자리를 만들지 않았는지**도 여기서 본다. 예산·메모·방문 체크는
 * `SharedPlanResponse` 에 없어서 못 그리는 것이고, 빈 카드를 두면 "불러오지 못했다" 로
 * 읽힌다.
 */
const PLAN: SharedPlan = {
  title: '몽실이와 제주 2박 3일',
  areaCode: '39',
  sigunguCode: '4',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  totalDays: 3,
  status: { code: 'CONFIRMED', name: '확정', description: '여행이 확정된 일정입니다.' },
  items: [
    {
      day: 1,
      sequence: 0,
      itemType: { code: 'PLACE', name: '장소', description: null },
      targetId: '212481712381923328',
      title: '천지연폭포',
      startTime: '10:30:00',
      place: {
        addr1: '제주특별자치도 서귀포시 천지동',
        indoor: false,
        firstImage: null,
        lat: 33.24,
        lng: 126.55,
      },
    },
    /* 장소 요약이 통째로 비는 항목 — 행이 사라지면 안 된다 (공통명세 S8) */
    {
      day: 1,
      sequence: 1,
      itemType: { code: 'MOVE', name: '이동', description: null },
      targetId: null,
      title: '버스로 이동',
      startTime: null,
      place: null,
    },
    {
      day: 2,
      sequence: 0,
      itemType: { code: 'MEAL', name: '식사', description: null },
      targetId: '212481712381923999',
      title: '한림 카페',
      startTime: '12:00:00',
      place: { addr1: '제주시 한림읍', indoor: true, firstImage: null, lat: null, lng: null },
    },
  ],
}

function renderShared(plan: SharedPlan = PLAN): string {
  return renderToStaticMarkup(createElement(SharedPlanSection, { plan }))
}

describe('공유 열람 — 정상', () => {
  it('제목·기간·상태를 그린다', () => {
    const html = renderShared()

    expect(html).toContain('몽실이와 제주 2박 3일')
    expect(html).toContain('확정')
    expect(html).toContain(messages.plan.totalDays.replace('{days}', '3'))
  })

  it('읽기 전용이라는 것을 낱말로 말한다 — 버튼이 없는 것만으로는 미완성과 구별되지 않는다', () => {
    expect(renderShared()).toContain(messages.plan.sharedReadOnlyNote)
  })

  it('항목 시작 시각을 초 없이 그린다', () => {
    const html = renderShared()

    expect(html).toContain('10:30')
    expect(html).not.toContain('10:30:00')
  })

  it('장소 요약이 없는 항목도 행이 남는다', () => {
    expect(renderShared()).toContain('버스로 이동')
  })

  it('totalDays 만큼 일자 섹션을 만든다 — 항목이 없는 3일차도 있다', () => {
    const html = renderShared()

    expect(html).toContain(messages.plan.dayLabel.replace('{day}', '3'))
    expect(html).toContain(messages.plan.sharedDayEmpty)
  })

  /*
    **빈 일자 문구가 소유자 것과 갈려 있어야 한다.** `dayEmpty`("아직 담은 곳이 없어요")의
    `아직` 은 지금 담으라는 말이라, 담을 수 없는 사람에게는 할 일을 잘못 알린다.
  */
  it('빈 일자에 소유자 문구를 쓰지 않는다', () => {
    expect(renderShared()).not.toContain(messages.plan.dayEmpty)
  })

  it('응답에 없는 값의 자리를 만들지 않는다 — 예산·메모·방문 체크', () => {
    const html = renderShared()

    expect(html).not.toContain('예산')
    expect(html).not.toContain('메모')
    expect(html).not.toContain('다녀옴')
  })

  it('장소를 가리키는 항목만 장소로 링크한다 — MOVE 의 targetId 는 장소가 아니다', () => {
    const html = renderShared()

    expect(html).toContain('/places/212481712381923328')
    expect(html).toContain('/places/212481712381923999')
  })
})

describe('공유 열람 — 실패 갈래', () => {
  const notFound = renderToStaticMarkup(createElement(SharedPlanNotFound))
  const expired = renderToStaticMarkup(createElement(SharedPlanExpired))

  it('404 에 재시도 버튼이 없다 — 데이터 부재는 재시도해도 같다', () => {
    expect(notFound).toContain(messages.plan.sharedNotFoundTitle)
    expect(notFound).not.toContain(messages.common.retry)
  })

  it('410 에도 재시도 버튼이 없다', () => {
    expect(expired).toContain(messages.plan.sharedExpiredTitle)
    expect(expired).not.toContain(messages.common.retry)
  })

  /*
    **이 테스트가 이 이슈의 핵심 회귀 방어다.** 백엔드가 404 와 410 을 가른 이유는
    "받은 사람이 새 링크를 요청할 수 있는 경우" 가 만료뿐이기 때문이다. 두 화면이 같은
    말을 하기 시작하면 그 구분이 사라진 것이다.
  */
  it('404 와 410 이 다른 말을 한다', () => {
    expect(notFound).not.toContain(messages.plan.sharedExpiredDescription)
    expect(expired).not.toContain(messages.plan.sharedNotFoundDescription)
    expect(expired).toContain('새 링크를 요청')
  })

  it('둘 다 홈으로 보낸다 — /plans 는 보호 경로라 미로그인을 로그인으로 튕긴다', () => {
    expect(notFound).not.toContain('href="/plans"')
    expect(expired).not.toContain('href="/plans"')
    expect(notFound).toContain('href="/"')
    expect(expired).toContain('href="/"')
  })
})
