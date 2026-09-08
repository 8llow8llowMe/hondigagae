import { messages } from '@/lib/messages'

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
    /* 모바일은 위아래, 데스크톱은 좌우. 좁은 화면에서 두 열을 붙이면 제목이 뭉갠다 */
    <div className="grid gap-4 md:grid-cols-2">
      <DiffColumn title={messages.plan.regenerateDayCurrent} rows={current} />
      <DiffColumn title={messages.plan.regenerateDayNext} rows={next} />
    </div>
  )
}

function DiffColumn({ title, rows }: { title: string; rows: readonly PlanDayDiffRow[] }) {
  return (
    <section className="border-border rounded-md border p-4">
      {/*
        **`h2` 다.** 껍데기의 `h1` 바로 아래이고 사이에 `h2` 가 없어 `h3` 는 단계를
        건너뛴다 — 이 화면의 다른 상태(대기·실패·빈 결과)는 모두 `h2` 를 쓴다.
      */}
      <h2 className="text-caption text-fg-muted font-semibold">{title}</h2>

      {rows.length === 0 ? (
        <p className="text-body-2 text-fg-muted mt-3">{messages.plan.regenerateDayEmpty}</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={`${index}-${row.title}`} className="flex items-start gap-3">
              {/*
                **`aria-hidden` 이다.** `<ol>` 안이라 스크린리더가 이미 순번을 읽어 주므로
                숫자를 남기면 "1, 1 오설록…" 으로 두 번 들린다 (`plan-item-row.tsx:108` ·
                `plan-editable-item-row.tsx:110` 과 같은 판단).
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
    </section>
  )
}
