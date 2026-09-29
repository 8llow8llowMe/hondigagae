import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PetDeleteConfirm, type PetDeleteConfirmProps } from '@/features/pet/pet-delete-section'
import { messages } from '@/lib/messages'
import { petCompanionSummary } from '@/test/fixtures/plan'
import { readSourceWithoutComments } from '@/test/source'

function render(overrides: Partial<PetDeleteConfirmProps> = {}) {
  return renderToStaticMarkup(
    createElement(PetDeleteConfirm, {
      petName: '몽실이',
      companions: { state: 'loading' },
      confirming: false,
      deleting: false,
      errorMessage: null,
      onStart: () => undefined,
      onCancel: () => undefined,
      onConfirm: () => undefined,
      ...overrides,
    }),
  )
}

describe('PetDeleteConfirm — 1단계', () => {
  it('삭제 버튼만 있고 확인 문구가 없다', () => {
    const markup = render()

    expect(markup).toContain(messages.pet.delete)
    expect(markup).not.toContain('되돌릴 수 없어요')
    expect(markup).not.toContain('취소')
  })
})

describe('PetDeleteConfirm — 확인 단계', () => {
  it('alertdialog 로 낸다 — 전환이 시각적으로만 전달되면 안 된다', () => {
    const markup = render({ confirming: true })

    // 인라인 `role="alert"` 였던 것을 `ConfirmModal` 로 옮겼다 (이슈 #70).
    // 되돌릴 수 없는 일이라 화면을 잡아두는 것이 맞다 (가이드 §5-2)
    expect(markup).toContain('role="alertdialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('되돌릴 수 없어요')
  })

  it('확인 문구에 반려견 이름이 들어간다', () => {
    expect(render({ confirming: true, petName: '초코' })).toContain('초코')
  })

  it('이름의 종성에 따라 목적격 조사가 갈린다 — 실측에서 발견한 버그', () => {
    expect(render({ confirming: true, petName: '몽실이' })).toContain('몽실이를 삭제할까요?')
    expect(render({ confirming: true, petName: '곰' })).toContain('곰을 삭제할까요?')
  })

  it('취소와 삭제 버튼이 함께 있다', () => {
    const markup = render({ confirming: true })

    expect(markup).toContain('취소')
    expect(markup).toContain(messages.pet.delete)
  })

  /**
   * **초기 포커스는 `ConfirmModal` 의 계약이다** (`initialFocusRef` → `useOverlay`).
   * effect 로 옮기므로 정적 마크업에는 `autofocus` 속성이 없다 — 여기서는 **취소가
   * 먼저 오는 순서**만 지킨다. 실제 포커스 이동은 브라우저 실렌더로 확인한다.
   */
  it('취소가 삭제보다 먼저 온다 — 파괴적 동작을 첫 타깃으로 두지 않는다', () => {
    const markup = render({ confirming: true })

    expect(markup.indexOf('취소')).toBeLessThan(markup.lastIndexOf(messages.pet.delete))
  })

  it('삭제 중이면 버튼이 disabled 다', () => {
    const markup = render({ confirming: true, deleting: true })

    expect(markup).toContain('aria-busy="true"')
  })

  it('오류 메시지를 표시한다', () => {
    const markup = render({ confirming: true, errorMessage: '일시적인 오류입니다.' })

    expect(markup).toContain('일시적인 오류입니다.')
  })

  it('오류가 없으면 오류 요소를 렌더하지 않는다', () => {
    const markup = render({ confirming: true })

    expect(markup).not.toContain('일시적인 오류입니다.')
  })

  it('삭제 버튼이 danger 톤이지만 문구로도 구분된다 — 색만으로 구분하지 않는다', () => {
    const markup = render({ confirming: true })

    expect(markup).toContain('삭제')
  })
})

/*
  #1042. 일정에 연결된 반려견을 경고 없이 지우던 것. 수치는 plan-service 가 센다
  (`GET /plans/companions/{petId}`) — 문장 조합 규칙은 `lib/pet/delete-companions.test.ts` 가
  잠그고, 여기서는 확인창이 그 문장을 **어디에** 세우는지를 본다.
*/
describe('PetDeleteConfirm — 동행 일정 (#1042)', () => {
  it('서버가 센 수를 확인창에 말한다', () => {
    const markup = render({
      confirming: true,
      companions: { state: 'ready', summary: petCompanionSummary },
    })

    expect(markup).toContain('이 아이가 동행하는 일정 2개에서 빠져요.')
    expect(markup).toContain('그중 1개는 동행 반려견이 없는 일정으로 남아요.')
    expect(markup).toContain('다녀온 일정 3개의 기록은 그대로 남아요.')
  })

  /*
    `alertdialog` 의 `aria-describedby` 가 설명 칸을 가리킨다. 본문 슬롯에 두면 열리는
    순간 영향 범위가 읽히지 않는다.
  */
  it('일정 문장이 설명 칸 안에 있다 — 열리는 순간 함께 읽힌다', () => {
    const markup = render({
      confirming: true,
      companions: { state: 'ready', summary: petCompanionSummary },
    })
    const described = /id="confirm-desc"[^>]*>([\s\S]*?)<\/div><\/div>/.exec(markup)?.[1] ?? ''

    expect(described).toContain('일정 2개에서 빠져요')
    expect(described).toContain('되돌릴 수 없어요')
  })

  it('되돌릴 수 없다는 경고가 일정 문장 뒤에 온다', () => {
    const markup = render({
      confirming: true,
      companions: { state: 'ready', summary: petCompanionSummary },
    })

    expect(markup.indexOf('일정 2개에서 빠져요')).toBeLessThan(markup.indexOf('되돌릴 수 없어요'))
  })

  it('일정과 상관없는 아이면 일정 문장이 없다 — 0 을 말하지 않는다', () => {
    const markup = render({
      confirming: true,
      companions: {
        state: 'ready',
        summary: {
          ...petCompanionSummary,
          editablePlanCount: 0,
          soleCompanionPlanCount: 0,
          completedPlanCount: 0,
        },
      },
    })

    expect(markup).not.toContain('일정 0개')
    expect(markup).not.toContain('빠져요')
    expect(markup).toContain('되돌릴 수 없어요')
  })

  it('받는 중에는 확인 중이라고 말하고 삭제 버튼은 열려 있다', () => {
    const markup = render({ confirming: true, companions: { state: 'loading' } })

    expect(markup).toContain(messages.pet.deleteCompanionLoading)
    expect(markup).not.toContain('disabled=""')
    // 단언이 헛돌지 않는다 — 삭제 중에는 같은 마크업에 그 속성이 선다
    expect(render({ confirming: true, deleting: true })).toContain('disabled=""')
  })

  /*
    집계는 판단을 돕는 정보이지 삭제의 전제가 아니다 — plan-service 장애가 반려견 삭제를
    빼앗으면 안 된다 (`PetDeleteSection` 머리주석). 수 없이도 참인 문장으로 대신한다.
  */
  it('집계를 못 받아도 삭제를 막지 않고 수 없는 문장으로 대신한다', () => {
    const markup = render({ confirming: true, companions: { state: 'failed' } })

    expect(markup).toContain(messages.pet.deleteCompanionFailed)
    expect(markup).not.toMatch(/일정 \d+개/)
    expect(markup).not.toContain('disabled=""')
  })

  it('집계 실패에 재시도 버튼을 달지 않는다 — 파괴 버튼 옆에 누를 것을 늘리지 않는다', () => {
    const markup = render({ confirming: true, companions: { state: 'failed' } })

    expect(markup).not.toContain(messages.common.retry)
  })
})

/*
  #1042. 삭제 직후 `GET /members/me/pets/{id}` 404 가 한 번 났다 — `petKeys.all` 을 그대로
  무효화해 이 화면이 관찰 중인 지운 아이의 상세를 다시 받았다. 무효화 동작 자체는
  `pet-delete-invalidation.test.ts` 가 `QueryObserver` 로 잠그고, 여기서는 **호출부가 그 함수를
  거치는지**를 본다 (`useQueryClient` 를 쓰는 컴포넌트라 node 에서 렌더되지 않는다).
*/
describe('PetDeleteSection — 삭제 뒤 무효화 (#1042)', () => {
  const source = readSourceWithoutComments('src/features/pet/pet-delete-section.tsx')

  it('도메인 전체를 직접 무효화하지 않는다 — 지운 아이의 상세를 다시 받게 된다', () => {
    expect(source).not.toContain('invalidateQueries')
    expect(source).not.toContain('PET_INVALIDATE_KEY')
  })

  it('성공 · 이미 지워짐(404) 두 갈래 모두 삭제 전용 무효화를 쓴다', () => {
    expect(source.match(/invalidateAfterPetDeleted\(queryClient, petId\)/g)).toHaveLength(2)
  })
})
