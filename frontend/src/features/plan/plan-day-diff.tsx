import { Surface } from '@/components/surface'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 재생성 확정 전 비교 (#128 · 하루재생성-세부명세 R5).
 *
 * **교체는 되돌릴 수 없다.** 계약에 일자 이력이 없어 undo 를 만들 수 없으므로,
 * **무엇을 잃는지 눈으로 보여 주는 것이 유일한 방어다.**
 *
 * 두 열이 서로 다른 타입에서 온다 — 왼쪽은 저장된 `PlanItemDetail`, 오른쪽은 아직
 * 보내지 않은 `PlanItemRequest` 다. **여기서 한 모양으로 좁혀 받는다** — 컴포넌트가
 * 두 타입을 다 알면 저장 형식이 바뀔 때마다 이 파일이 함께 흔들린다.
 */
export type PlanDayDiffRow = {
  title: string
  /** 주소·유형 같은 부연. 없으면 줄 자체가 빠진다 */
  caption: string | null
}

export function PlanDayDiff({
  current,
  next,
}: {
  current: readonly PlanDayDiffRow[]
  next: readonly PlanDayDiffRow[]
}) {
  return (
    /*
      모바일은 위아래, 데스크톱은 좌우. 좁은 화면에서 두 열을 붙이면 제목이 뭉갠다.

      **간격은 카드 사이 값이다** (`DESIGN.md §0` "카드 사이 간격이 경계다") — 모바일 8 ·
      데스크톱 24 로 `SurfaceStack` 과 같다. 두 열이 L1 카드라 그 틈으로 L0 바닥이 비친다.
    */
    <div className="grid gap-2 md:grid-cols-2 md:gap-6">
      <DiffColumn title={messages.plan.regenerateDayCurrent} rows={current} />
      <DiffColumn title={messages.plan.regenerateDayNext} rows={next} />
    </div>
  )
}

/**
 * 비교의 한 열 — **L1 카드다** (`DESIGN.md §0`, #451).
 *
 * 카드 판정 3문을 셋 다 통과한다: ① 자기 제목(`지금` / `이렇게 바뀌어요`)이 있고
 * ② 혼자 떼어놔도 말이 되며 ③ 항목이 여럿이다. 수제 박스(`rounded-md border p-4`)를
 * 걷고 `Surface` 로 바꾼 이유가 그것이다 — radius 도 8 이 아니라 섹션 값 12 가 맞다.
 *
 * **제목은 `Surface` 가 그린다.** 여전히 `h2` 라 껍데기의 `h1` 다음 단계를 건너뛰지
 * 않는다 — 이 화면의 다른 상태(대기·실패·빈 결과)도 모두 `h2` 를 쓴다.
 */
function DiffColumn({ title, rows }: { title: string; rows: readonly PlanDayDiffRow[] }) {
  return (
    <Surface title={title}>
      {rows.length === 0 ? (
        <p className={cn('text-body-2 text-fg-muted pb-5', INSET_CLASS.card)}>
          {messages.plan.regenerateDayEmpty}
        </p>
      ) : (
        /*
          순서가 뜻을 갖는 목록이라 `ol` 이다 — `ul` 인 `SurfaceList` 를 쓸 수 없어 같은
          구분선 규약(항목 **사이에만**)을 여기에 건다 (#447 `plan-day-editor.tsx` 와 같다).

          **목록 위 1px 선은 `ol` 이 갖는다.** 제목 줄과 첫 항목을 가르는 선은 카드의
          몫이라 목록이 그리면 제목 없는 카드에서 허공에 뜬다 — 그래서 `SurfaceList` 는
          그 선을 그리지 않고, 제목이 **있는** 이 카드가 #447 일자 카드처럼 직접 건다.
        */
        <ol className="[&>li+li]:border-border border-border border-t [&>li+li]:border-t">
          {rows.map((row, index) => (
            <li
              key={`${index}-${row.title}`}
              /* 항목 사이 간격은 구분선이 대신한다 — `gap` 을 함께 주면 선이 뜬 것처럼 보인다 */
              className={cn('flex items-start gap-3 py-3', INSET_CLASS.card)}
            >
              {/*
                **`aria-hidden` 이다.** `<ol>` 안이라 스크린리더가 이미 순번을 읽어 주므로
                숫자를 남기면 "1, 1 오설록…" 으로 두 번 들린다 (`plan-item-row.tsx:108` ·
                `plan-editable-item-row.tsx:110` 과 같은 판단).

                **`--band` 채움은 그대로 둔다.** 카드 안 자식이 갖는 배경이지만 이것은
                면이 아니라 **L2 콘텐츠 배지**라 radius 12 모서리를 덮지 않는다 (#447
                `plan-item-row` 와 같은 판단).
              */}
              <span
                aria-hidden
                className="bg-band text-fg-muted text-caption flex w-6 shrink-0 items-center justify-center rounded-sm font-bold tabular-nums"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-body-2 text-fg font-semibold break-keep">{row.title}</p>
                {row.caption !== null && (
                  <p className="text-caption text-fg-muted mt-1 line-clamp-1 font-medium">
                    {row.caption}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  )
}
