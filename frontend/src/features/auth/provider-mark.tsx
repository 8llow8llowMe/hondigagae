/**
 * 소셜 제공자 마크 — Figma `카카오 네이버 로그인 디자인 가이드 (Community)` 의
 * `로고` 섹션(node `122:160`) path 를 그대로 옮긴다. 카카오는 `Size=md`(node `1:106`),
 * 네이버는 `size=md`(node `4:163`) 가 원본이다.
 *
 * **`src/components/` 가 아니라 여기 있다.** `DESIGN.md` §2-8 이 소셜 브랜드 색을
 * **"소셜 로그인 버튼에만"** 허용했는데, 공용 컴포넌트 폴더에 두면 그 제한이 주석 한 줄로만
 * 남는다. `features/auth` 안에 두면 **자리가 제한을 대신 지킨다** — 다른 기능이 쓰려면
 * 계층을 건너야 하고, 그때 `fe-boundary-guard` 가 잡는다.
 *
 * **`Wordmark` 와 달리 `viewBox` 가 제각각이다.** 두 원본의 여백 관례가 다르기 때문이고,
 * 맞추려고 손대지 않는다 — 네이버 N 은 상자에 꽉 차고(0→16) 카카오 말풍선은 위아래
 * 0.6 씩 비운다(0.6→17.4). 같은 px 로 그리면 네이버가 더 커 보이므로 **호출부가 원본의
 * 절대 크기(네이버 16 · 카카오 18)를 그대로 쓴다** — 각 사 가이드가 자기 버튼에서
 * 정한 마크/버튼 비율이 그 두 숫자다.
 *
 * 두 마크 다 `aria-hidden` 이다. 제공자 이름은 **버튼 라벨이 텍스트로** 들고 있고
 * (소셜콜백-세부명세 D6: "로고만 두지 않는다"), 마크가 또 이름을 주면 두 번 읽힌다.
 */

/**
 * 카카오 말풍선.
 *
 * **`currentColor` 다.** 원본은 `#000000` 으로 박혀 있는데 이 마크가 서는 곳은
 * `Button` 의 `kakao` 변형 하나뿐이고 거기 글자색이 `--kakao-fg`(#191600) 다. 값을
 * 박아 두면 글자와 마크가 **다른 검정 둘**이 되므로 버튼이 정하게 한다 — `Wordmark` 가
 * `currentColor` 를 쓰는 것과 같은 판단이다.
 */
export function KakaoMark() {
  return (
    <svg
      viewBox="0 0 18 18"
      width={18}
      height={18}
      fill="currentColor"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.00002 0.6C4.02917 0.6 0 3.71296 0 7.55228C0 9.94003 1.5584 12.045 3.93152 13.297L2.93303 16.9445C2.84481 17.2668 3.21341 17.5237 3.49646 17.3369L7.87334 14.4482C8.2427 14.4838 8.61808 14.5047 9.00002 14.5047C13.9705 14.5047 17.9999 11.3918 17.9999 7.55228C17.9999 3.71296 13.9705 0.6 9.00002 0.6Z"
      />
    </svg>
  )
}

/**
 * 네이버 N.
 *
 * **`currentColor` 를 쓸 수 없다.** 이 마크는 흰 배경 변형(`Button` 의 `secondary`)
 * 위에 서고 그 글자색은 `--fg` 다. 물려받으면 N 이 무채색이 되어 네이버 버튼임을
 * 알아볼 단서가 사라진다 — `BrandSymbol` 이 헤더 링크의 글자색을 물려받지 않는 것과
 * 같은 이유다. 토큰으로 칠해 값이 두 곳으로 갈리는 것은 막는다.
 *
 * **초록 채움 + 흰 글자(Figma `variant=green`)를 쓰지 않는다.** `DESIGN.md` §2-8 이
 * 실측으로 못박았다 — 그 조합은 **2.25:1 로 WCAG AA 미달**이다. Figma 가 같은 이유로
 * 함께 제공하는 `variant=white (light)`(node `122:133`) 가 정본이고, 그 변형의 구조
 * (흰 면 + 1px 테두리 + 초록 마크)는 이 저장소의 `Button` `secondary` 와 같다.
 */
export function NaverMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="var(--naver-mark)"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d="M10.8491 8.56267L4.91687 0H0V16H5.15088V7.436L11.0831 16H16V0H10.8491V8.56267Z" />
    </svg>
  )
}
