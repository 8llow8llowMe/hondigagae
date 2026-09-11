import { Button, ButtonLink } from '@/components/button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Surface, SurfaceList } from '@/components/surface'
import { PetRow } from '@/features/pet/pet-row'
import {
  PET_SKELETON_COUNT,
  PetListBaselineSkeleton,
  PetRowSkeleton,
} from '@/features/pet/pet-row-skeleton'
import { MAX_PET_COUNT } from '@/lib/api/pet'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { Pet } from '@/types/pet'

export type PetListSectionProps = {
  pets: Pet[]
  totalCount: number
  loading: boolean
  errorStatus: number | null
  onRetry: () => void
}

/**
 * **이 화면의 L1 카드다** (`DESIGN.md §0`, 이슈 #464). 제목·설명·등록 버튼·네 상태가
 * 전부 카드 하나에 든다.
 *
 * **카드를 페이지가 아니라 여기서 그린다.** 머리의 `등록하기` 가 상한(`totalCount >= 5`)에
 * 따라 눌리고 안 눌리는데 그 값이 응답에서 온다 — `styling-guide.md §3-1` 의 기준
 * ("머리 값이 응답에서 오면 섹션이, 정적이면 페이지가")에 그대로 걸린다.
 *
 * 상태 분기는 목록-세부명세 D5 를 따른다 —
 * 빈 목록은 `EmptyState`(재시도 없음), 5xx 는 `ErrorState`(재시도 있음).
 */
export function PetListSection({
  pets,
  totalCount,
  loading,
  errorStatus,
  onRetry,
}: PetListSectionProps) {
  const limitReached = totalCount >= MAX_PET_COUNT

  /**
   * **머리의 등록 버튼은 셀 수 있을 때만 낸다.** 로딩 중에는 `totalCount` 가 0 이라
   * 상한에 닿은 사람에게도 눌리는 버튼이 서고, 눌러 들어가면 필드 10개를 채운 뒤
   * `PET_002` 를 받는다 — 이 화면이 막으려던 바로 그 낭비다 (목록-세부명세 D4).
   * 오류에도 셀 수 없고, 0건에는 `EmptyState` 가 자기 등록 버튼을 이미 갖고 있다
   * (둘 다 내면 같은 화면에 등록 버튼이 둘이다). 저장한 곳(#462)의 `countable` 과
   * 같은 판단이다.
   */
  const countable = !loading && errorStatus === null && pets.length > 0

  return (
    <Surface
      lead
      titleId="pet-list-heading"
      title={messages.pet.listTitle}
      description={<p className="text-body-2 text-fg-muted">{messages.pet.listDescription}</p>}
      /*
        **등록은 머리의 액션이다** — 장소 목록의 `ViewToggle`(#439)이 선 자리와 같다.
        2a 때는 개수 줄과 한 덩어리로 목록 위에 있었는데, 3a 에서 목록 위 줄은 **목록을
        설명하는 자리**(기준 줄)라 화면의 주 액션이 거기 서면 둘이 섞인다.

        **상한을 서버 오류로 알게 하지 않는다.** 등록 화면까지 들어가 필드 10개를 채운 뒤
        `PET_002` 를 받는 것은 낭비다 (목록-세부명세 D4). `disabled` 만 두지 않고 이유를
        글자로 함께 내는 것도 그대로다 — `disabled` 는 스크린리더에 "왜" 를 말하지 못한다(D6).
      */
      trailing={
        countable ? (
          limitReached ? (
            /*
              **이유를 버튼과 같은 덩어리에 둔다.** `disabled` 는 포커스를 받지 못해
              스크린리더가 그 버튼에 닿지 못하므로, 이유가 멀어지면 왜 못 누르는지 알
              길이 없다 (목록-세부명세 D6). 홈의 같은 자리(`profile-card.tsx`)도 비활성
              표시 바로 아래에 이유를 붙인다 — 3층으로 옮기며 이 줄만 기준 줄로 흘렀던
              것을 되돌렸다.
            */
            <div className="flex flex-col items-end gap-1">
              <Button variant="primary" disabled>
                {messages.pet.register}
              </Button>
              <p className="text-caption text-fg-muted">{messages.pet.limitReached}</p>
            </div>
          ) : (
            /* `<Link>` 안에 `<Button>` 을 넣지 않는다 — 탭 정지가 둘이 되고 Space 가
               안쪽 버튼을 누른다. 이 자리를 위한 것이 `ButtonLink` 다 (styling-guide §2) */
            <ButtonLink href="/pets/new">{messages.pet.register}</ButtonLink>
          )
        ) : undefined
      }
    >
      <PetListBody
        pets={pets}
        totalCount={totalCount}
        loading={loading}
        errorStatus={errorStatus}
        onRetry={onRetry}
      />
    </Surface>
  )
}

/**
 * 카드 안 네 상태. **배타적으로** 렌더한다 (목록-세부명세 D5).
 *
 * **인셋이 prop 이 아니다.** 이 섹션은 자기가 `Surface` 를 그리므로 정의상 항상 카드
 * 안이다 — 카드 밖 호출자가 있는 `PlaceListSection` 과 다르다 (#462 에서 같은 판단).
 * 네 상태가 **같은 축**에 서는 것은 그대로다 (#451).
 */
function PetListBody({ pets, totalCount, loading, errorStatus, onRetry }: PetListSectionProps) {
  const inset = 'card'

  if (loading) {
    return (
      <>
        <PetListBaselineSkeleton inset={inset} />
        <SurfaceList aria-busy>
          {Array.from({ length: PET_SKELETON_COUNT }, (_, index) => (
            <PetRowSkeleton key={index} inset={inset} />
          ))}
        </SurfaceList>
      </>
    )
  }

  // 404 는 목록에 없다 — /pets 는 항상 존재하는 컬렉션이다.
  // 남는 것은 일시 장애뿐이라 재시도를 준다.
  if (errorStatus !== null) {
    return (
      <ErrorState
        inset={inset}
        title={messages.pet.loadFailedTitle}
        description={messages.pet.loadFailedDescription}
        onRetry={onRetry}
      />
    )
  }

  if (pets.length === 0) {
    return (
      <EmptyState
        inset={inset}
        title={messages.pet.emptyTitle}
        description={messages.pet.emptyDescription}
        action={<ButtonLink href="/pets/new">{messages.pet.register}</ButtonLink>}
      />
    )
  }

  return (
    <>
      {/*
        **기준 줄** — 목록이 무엇을 얼마나 담고 있는지 말한다 (긴급 목록 #461 과 같은 자리).
        아래에 선을 그어 목록의 시작을 표시한다: 여백만 두면 이 줄이 첫 번째 행처럼 읽힌다.

        개수에 단위를 붙인다 — 등록 버튼이 카드 머리로 올라가면서 이 줄만 남는데,
        맨 숫자(`2 / 5`)로는 무엇의 개수인지 읽히지 않는다.
      */}
      <div
        className={cn(
          'border-border flex flex-wrap items-center gap-2 border-b pt-3 pb-3',
          INSET_CLASS[inset],
        )}
      >
        <p className="text-body-2 text-fg-muted tabular-nums">
          {messages.pet.countOfMax
            .replace('{count}', String(totalCount))
            .replace('{max}', String(MAX_PET_COUNT))}
        </p>
      </div>

      <SurfaceList>
        {pets.map((pet) => (
          <PetRow key={pet.petId} pet={pet} inset={inset} />
        ))}
      </SurfaceList>
    </>
  )
}
