import Link from 'next/link'

import { ChevronLeftIcon } from '@/components/icons'

/**
 * 인증 하위 화면의 상단바 — `←` + 화면 이름 (#1283 C3 · C4).
 *
 * 가입 · 비밀번호 찾기에서 나가는 길이 카드 맨 아래 텍스트 링크뿐이었다. 앱 사용자가 출구를
 * 찾는 자리는 왼쪽 위다 — 카카오 · 네이버 · 토스의 인증 하위 화면이 모두 그렇다.
 *
 * **`BackLink` 를 쓰지 않는다.** 그것은 `(main)` 화면의 "상위 화면으로" 텍스트 링크이고
 * (`back-link.tsx`), 여기는 글자 없는 아이콘 하나에 화면 이름이 붙는 앱 상단바라 모양이 다르다.
 *
 * **화면 이름이 곧 `h1` 이다.** 본문의 큰 글자는 단계별 질문("가입한 이메일을 알려주세요")이라
 * 화면 이름과 질문이 같은 크기로 두 번 서던 것(C4)을 크기로 가른다. 이름을 넘기지 않으면
 * 제목은 화면이 따로 단다 — 회원가입처럼 본문 제목이 곧 화면 이름인 경우다.
 */
export function AuthTopBar({
  backHref,
  backLabel,
  title,
}: {
  backHref: string
  /** 아이콘 버튼의 이름. 아이콘은 `aria-hidden` 이라 이것이 유일한 이름이다 (DESIGN.md §9) */
  backLabel: string
  title?: string | undefined
}) {
  return (
    /*
      **`-ml-3` 으로 아이콘 잉크를 본문 글줄에 맞춘다.** 누르는 자리는 44 인데 아이콘은 24 라
      그대로 두면 잉크가 글줄에서 10px 들어가 선다. 터치 영역은 그대로 44 다.
    */
    <div className="-ml-3 flex min-h-14 items-center gap-1">
      <Link
        href={backHref}
        className="text-fg focus-visible:ring-brand-500 inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronLeftIcon size={24} aria-hidden />
        <span className="sr-only">{backLabel}</span>
      </Link>
      {title !== undefined && <h1 className="text-body-1 text-fg font-semibold">{title}</h1>}
    </div>
  )
}
