import { Wordmark } from '@/components/brand/wordmark'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'

/**
 * 전역 푸터 — 이슈 #399.
 *
 * **서버 컴포넌트다.** 상태도 세션 분기도 없다.
 *
 * **이 푸터의 존재 이유는 데이터 출처 표기다.** 공모전 출품물이고 화면 곳곳이 공공데이터를
 * 쓰는데 그 사실이 개별 캡션으로만 흩어져 있었다 (`messages/footer.ts` 주석).
 *
 * **바(`<footer>`)는 전폭이고 안쪽 div 만 캡한다** — 헤더와 같은 구조다 (#376). 캡을
 * 바에 걸면 `border-t` 가 화면 가운데서 끊긴다. 좌우 인셋은 `INSET_CLASS.main` 을
 * 참조한다 (#386 · #393) — 문자열을 다시 적지 않는다.
 *
 * **지도가 뷰포트를 꽉 채우는 화면에는 나오지 않는다.** `app/globals.css` 의
 * `body:has(.map-canvas-height) .site-footer` 가 감춘다 — 그 화면은 `100dvh` 라 푸터가
 * 붙으면 지도 화면에 페이지 스크롤이 생긴다. **레이아웃이 화면마다 분기하지 않고**
 * 지도 쪽이 자기 성질(전폭 지도 클래스)로 빠지는 방식이다 — `.rail-layout` 에 가입하지
 * 않는 것으로 전폭을 표현하는 #376 의 설계와 같은 축이다.
 *
 * **모바일 탭바 자리를 비운다** (`.site-footer` 의 `padding-block-end`). 탭바가 `fixed`
 * 라 마지막 줄이 그 뒤로 들어간다.
 *
 * **없는 링크를 만들지 않는다** — 이용약관·문의는 아직 페이지가 없다. 자리만 잡아 두면
 * 눌러 보고 아무 일도 일어나지 않는다.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer border-border bg-bg border-t">
      <div className={cn('content-container flex flex-col gap-4 py-8 md:py-10', INSET_CLASS.main)}>
        <div className="flex flex-col gap-2">
          {/*
            워드마크는 라이브 텍스트가 아니다 (아트보드 `브랜드 자산` 2절) — 헤더와 같은
            컴포넌트를 쓴다. **심볼은 붙이지 않는다**: 헤더의 락업(#240)은 상시 노출되는
            브랜드 자리의 결정이고, 푸터는 그 자리를 두 번 만들지 않는다.
          */}
          <Wordmark />
          <p className="text-body-2 text-fg-muted">{messages.footer.tagline}</p>
        </div>

        {/*
          출처는 목록이다 — `<ul>` 로 둔다. 쉼표로 이은 한 문장으로 쓰면 스크린리더가
          기관 이름 다섯 개를 한 덩어리로 읽는다.

          `gap-x-3` 이 구분 역할을 한다 — 가운뎃점을 문자로 끼우면 그것까지 읽힌다.
        */}
        <div className="flex flex-col gap-1">
          <h2 className="text-caption text-fg-muted font-semibold">
            {messages.footer.sourcesLabel}
          </h2>
          <ul className="text-caption text-fg-muted flex flex-wrap gap-x-3 gap-y-1 font-medium">
            {messages.footer.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>

        <div className="border-border flex flex-col gap-1 border-t pt-4">
          <p className="text-caption text-fg-muted font-medium">{messages.footer.disclaimer}</p>
          <p className="text-caption text-fg-subtle font-medium">{messages.footer.contest}</p>
        </div>
      </div>
    </footer>
  )
}
