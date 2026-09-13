import Link from 'next/link'

import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import { PetAvatar } from '@/components/pet-avatar'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import type { Pet } from '@/types/pet'

/**
 * `내 반려견` 행 — 아트보드 01.
 *
 * **L1 카드 안의 L2 항목이다** (`DESIGN.md §0`, 이슈 #466). 자기 테두리를 두르지 않고
 * 구분선은 `SurfaceList` 가 항목 **사이에만** 긋는다 — `PetRow`(#464)와 같은 규약이다.
 * **hover 채움도 걷었다**: 카드 안 자식이 불투명 면을 가지면 radius 12 모서리를 덮는다(§0).
 *
 * **계정 설정보다 위에 있다.** 탭바가 4개 고정이라 반려견은 이 화면을 통해서만
 * 들어온다 (아트보드 01 주석).
 *
 * **조회 실패는 이 행을 통째로 숨긴다** — 그 판단은 호출부(`MyPageView`)가 한다.
 * 여기까지 왔다면 그릴 값이 있다는 뜻이다 (0마리 포함).
 *
 * 이동이므로 `<a>` 다. 모양이 같아도 동작 항목(`<button>`)과 역할이 다르다 (D6).
 */
export function MyPetsRow({
  pets,
  totalCount,
  inset = 'card',
}: {
  pets: Pet[]
  totalCount: number
  inset?: Inset
}) {
  return (
    <li className={INSET_CLASS[inset]}>
      <Link
        href="/pets"
        className="focus-visible:ring-brand-500 flex min-h-14 items-center gap-3 py-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
      >
        {/*
          **리딩은 40px 고정 슬롯이다** (#468). 예전에는 아바타 N개를 `-space-x-2` 로 겹쳐
          폭이 `32 + 24(N-1)` 로 변했고 0마리면 블록 자체가 사라졌다 — 390 실측에서 글줄이
          16(0마리) · 60(1) · 84(2) · 156(5) 으로 움직여, 바로 아래 `저장한 장소`(68)와
          **어느 마릿수에서도 맞지 않았다.** `inset.ts` 가 "왼쪽 세로선은 페이지의 기준선"
          이라고 적어 둔 것과 같은 유형이고, #466 이 둘을 한 카드에 붙이면서 드러났다.

          **개수를 세는 일은 아바타가 아니라 부제가 한다.** 아래 줄이 이름을 전부 늘어놓고
          `N/5` 까지 낸다 — 겹친 원을 세는 것보다 정확하다. 그래서 슬롯에는 **한 마리만**
          둔다. `+N` 배지는 만들지 않는다: 이 저장소에 그 패턴이 없고 사용처가 여기
          하나뿐이라, 추측으로 API 를 만드는 #422 의 전례가 된다.

          **0마리는 `PlusIcon` 이다.** 슬롯을 비우면 글줄이 다시 16 으로 당겨진다. 이 행은
          그때 "등록하러 가기" 가 되므로(`/pets` 로 가고 부제가 `아직 등록한 반려견이
          없어요`) 채움도 그 말을 한다 — 옆 행의 `bg-band` 원형과 같은 모양이다.
        */}
        {pets[0] === undefined ? (
          <span className="bg-band text-fg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
            <PlusIcon size={20} />
          </span>
        ) : (
          <PetAvatar name={pets[0].name} size="xl" />
        )}

        {/* `h3` 는 flow content 라 `span` 안에 들 수 없다 — `PetRow` 와 같이 `div` 다 */}
        <div className="min-w-0 flex-1">
          {/*
            **`h3` 다.** 담는 카드 제목(`내 정보`)이 `h2` 라 항목이 같은 레벨이면 문서
            구조가 평평해진다 — 3a 에서 목록이 카드 안으로 들어오며 한 단 내려왔다
            (`PetRow` 와 같은 처리).
          */}
          <h3 className="text-body-1 text-fg block font-semibold">{messages.member.myPets}</h3>

          {/*
            **개수는 말줄임 밖에 둔다.** 이름과 개수를 한 문자열로 이어 `truncate` 를
            걸면 줄 **맨 끝**에 있는 개수가 가장 먼저 버려진다 — 390에서 5마리면
            `몽실이 · 보리 · 초코라떼 · 코코 ·…` 로 잘려 `5/5` 가 사라졌다. 이 행이
            존재하는 이유("들어가기 전에 안이 비었는지 알 수 있어야 한다")가 바로 그
            값이라, 이름만 줄이고 개수는 `shrink-0` 으로 지킨다. 같은 카드의
            `저장한 장소` 가 개수를 단독 줄로 내는 것과 같은 결과다.

            **단위를 붙인다** (#468). 예전에는 `member.petsCount` 가 `2/5` 로 단위 없이
            냈는데 바로 아래 `저장한 장소` 는 `12/100곳` 이다 — 다른 밴드였을 때는 안
            보였지만 #466 이 둘을 연속 두 줄로 붙이면서 나란히 읽힌다. 반려견 목록 화면이
            이미 쓰는 `pet.countOfMax`(`N/5마리`)로 맞췄다 (#464).
          */}
          {pets.length === 0 ? (
            <span className="text-body-2 text-fg-muted block truncate">
              {messages.member.petsEmpty}
            </span>
          ) : (
            <span className="text-body-2 text-fg-muted flex min-w-0 gap-1">
              <span className="truncate">{pets.map((pet) => pet.name).join(' · ')}</span>
              <span className="shrink-0 tabular-nums">
                ·{' '}
                {messages.pet.countOfMax
                  .replace('{count}', String(totalCount))
                  .replace('{max}', String(MAX_PET_COUNT))}
              </span>
            </span>
          )}
        </div>

        <ChevronRightIcon size={20} className="text-fg-subtle shrink-0" />
      </Link>
    </li>
  )
}
