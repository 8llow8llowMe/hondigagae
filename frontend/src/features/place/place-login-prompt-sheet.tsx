'use client'

import { BottomSheet } from '@/components/bottom-sheet'
import { Button, ButtonLink } from '@/components/button'
import { toLoginHref } from '@/features/nav/menu-items'
import { messages } from '@/lib/messages'
import { withObjectParticle } from '@/lib/text/korean'

/**
 * 미로그인이 담기·저장을 눌렀을 때 — 아트보드 `혼디가개 장소 상세` 04 ④.
 *
 * **곧바로 로그인으로 튕기지 않는다.** 아트보드가 시트를 하나 두고 `로그인` /
 * `둘러보기 계속` 을 함께 준다 — 로그인할 생각이 없는 사람의 둘러보기를 끊지 않는다.
 *
 * **`returnTo` 에 의도를 실어 보낸다.** 담기는 `?add=1` 을 붙여, 로그인 후 돌아왔을 때
 * 장소 상세가 담기 시트를 다시 연다 — "담으려던 장소를 기억하지 못하면 이탈한다"
 * (아트보드 주석). 저장은 붙이지 않는다: 돌아오자마자 누른 적 없는 저장이 실행되면
 * 사용자가 하지 않은 쓰기가 일어난다. 아트보드도 시트 재개만 약속했다.
 */
export function PlaceLoginPromptSheet({
  open,
  onClose,
  intent,
  place,
}: {
  open: boolean
  onClose: () => void
  /** 무엇을 하려다 막혔는가. 문구와 `returnTo` 가 갈린다 */
  intent: 'add' | 'save'
  place: { placeId: string; title: string }
}) {
  const withParticle = withObjectParticle(place.title)

  const title = intent === 'add' ? messages.plan.addToPlanLoginTitle : messages.favorite.loginTitle
  const description = (
    intent === 'add' ? messages.plan.addToPlanLoginDescription : messages.favorite.loginDescription
  ).replace('{title}', withParticle)

  const returnTo = intent === 'add' ? `/places/${place.placeId}?add=1` : `/places/${place.placeId}`

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 px-4 pt-1 pb-5">
        <p className="text-body-2 text-fg-muted break-keep">{description}</p>

        <div className="flex flex-col gap-2">
          <ButtonLink href={toLoginHref(returnTo)} size="lg">
            {messages.plan.addToPlanLoginAction}
          </ButtonLink>
          <Button variant="secondary" size="lg" onClick={onClose}>
            {messages.plan.addToPlanLoginDismiss}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
