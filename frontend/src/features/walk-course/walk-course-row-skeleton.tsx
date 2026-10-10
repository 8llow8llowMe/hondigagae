import { Skeleton } from '@/components/skeleton'

/** 첫 조회 스켈레톤 카드 수 — `코스목록-세부명세.md` D5 */
export const WALK_COURSE_SKELETON_COUNT = 6

/**
 * 실제 카드와 **같은 골격**으로 그린다 (가이드 §6 loading).
 *
 * **바깥 상자 클래스를 `WalkCourseRow` 와 글자 그대로 맞춘다** (#800). 표였을 때 실제 행은
 * 6칸 그리드인데 스켈레톤만 세로 블록이라 로딩→결과 전환에서 약 168px 이 위로 당겨졌다.
 * 카드로 바뀌어도 규칙은 그대로다 — 높이를 따로 계산해 맞추지 않고 같은 클래스를 쓴다.
 *
 * **사진 자리를 만든다.** 표에서는 만들지 않았는데, 그 근거가 *"29개 중 25개에 이미지가
 * 없어 대다수 행이 응답과 함께 좌로 밀린다"* 였다 (#800). 재적재 뒤 **29개 전부가 이미지를
 * 갖고**(2026-09-21 dev 실측) 사진이 카드의 가장 큰 덩어리라, 이제는 자리를 비우는 쪽이
 * 점프를 만든다. 원천이 다시 비면 이 판단을 되돌린다.
 *
 * **글줄은 셋이다** — 제목 · 거리·소요시간 · 시종점. 실제 카드와 같은 여백(`mt-1.5`)을 쓴다.
 */
export function WalkCourseRowSkeleton() {
  return (
    <li className="h-full">
      <div className="border-border bg-bg block h-full overflow-hidden rounded-lg border">
        {/*
          **`h-auto` 가 있어야 비율이 산다.** `Skeleton` 의 `text` 변형이 `h-4` 를 들고
          오는데, 높이가 박혀 있으면 `aspect-16/10` 이 계산할 여지가 없어 사진 자리가
          16px 짜리 띠가 된다. 같은 그룹의 값이라 `h-auto` 가 `h-4` 를 밀어낸다.
        */}
        <Skeleton className="aspect-16/10 h-auto w-full rounded-none" />

        <div className="px-4 pt-3 pb-4">
          {/* 제목 줄 — 번호 + 구간명이 한 줄이라 뼈대도 한 줄이다 */}
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-1.5 h-5 w-32" />
          <Skeleton className="mt-1.5 h-4 w-3/4" />
        </div>
      </div>
    </li>
  )
}
