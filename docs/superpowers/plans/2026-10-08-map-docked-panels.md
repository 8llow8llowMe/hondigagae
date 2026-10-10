# 지도 패널 도킹 — 구현 계획 (#1232, PR A)

> 착수 시점 스냅숏이다. 진행 상황은 이슈 #1232 와 PR 이 말한다.
> 명세: `frontend/docs/features/place/지도패널-도킹-세부명세.md` (D0–D11).
> 이 PR 은 D11 의 1–3(축척 · `/places` · 담기 지도). 긴급 시설(D10)은 PR B 로 나눈다.

## 실측으로 정한 것 (D5)

- 2026-10-08 headless 1440: `setCopyrightPosition(BOTTOMRIGHT, false)` 에서 축척 막대가 로고와 **함께**
  우하단으로 간다(축척 x 930 · 로고 x 958, 1000 폭 지도). `reversed=true` 면 순서가 바뀐다(로고 안쪽).
  명세 D2 그림(`축척 ▬▬ kakao`)과 같은 `false` 를 쓴다. D5 대안은 필요 없다.

## 구조

```text
지도 루트 (relative)
├─ MapCanvas (copyrightPosition="right")
├─ 도킹 래퍼  absolute inset-y-0 left-0 · lg:flex · 접히면 -translate-x-full (inert 아님)
│   ├─ 스택 #id  flex h-full · inert={!panelOpen} · 오른쪽 그림자 하나(.map-dock-shadow)
│   │   ├─ 목록 400  border-r  (미리보기 있으면 lg:max-xl:invisible)
│   │   └─ 미리보기 400  border-r  (≥1280 흐름 안 = 목록 옆 / 그 아래 absolute left-0 = 목록 자리)
│   └─ 손잡이  absolute left-full top-1/2 — 래퍼 오른쪽 끝 = 스택 오른쪽 끝
```

- **손잡이를 래퍼의 `left-full` 에 매단다.** 래퍼 폭이 곧 스택 폭(400 · 800 · 접힘 0)이라 자리 계산을
  폭마다 따로 적지 않는다. 래퍼를 `-100%` 밀면 손잡이가 정확히 x=0 에 남는다.
- 1024~1279 미리보기는 `absolute` 로 목록 위에 겹쳐 래퍼 폭(400)에 들지 않는다 → 손잡이 x=400.
- 그림자는 스택에 한 번, `clip-path` 로 오른쪽만 남긴다(위는 헤더, 왼쪽은 화면 끝).
- `selectedOffset` 은 스택 오른쪽 끝을 잰다(미리보기 열림 때만 넘기는 것은 그대로 — 담기 지도 동작 불변).

## 담기 지도 머리 (D9)

- 카드 모양(테두리 · 곡률 · 그림자 · 폭)을 `plan-add-place-view` 의 `head` 에서 걷어 `PlaceMapView` 가
  자리에 맞게 입힌다: 떠 있는 기둥(모바일 · 데스크톱 접힘)은 카드, 패널 안(데스크톱 열림)은 맨 위 블록 + 아래 경계.
- 접힌 동안 퇴로: 떠 있는 머리 카드가 `lg` 에서 접혔을 때만 보인다(펼치면 패널 안 머리와 자리를 바꾼다).
- `panelTopInset` · `PANEL_TOP_INSET` 은 쓸 곳이 없어져 걷는다.

## 순서

1. `kakao-maps.d.ts` 타입 + `MapCanvas` `copyrightPosition` 옵션.
2. `globals.css` — 걷기(`.map-panel-collapsed` · `.map-preview-after-handle`), 값 바꾸기(`.map-preview-beside` 제거 →
   흐름 배치, `.map-research-beside-preview` 800, 재검색 `left` = 400), `.map-dock-shadow` 추가.
3. `place-map-view.tsx` 도킹 래퍼 · 손잡이 · 머리 이동.
4. `place-map-skeleton.tsx` 같은 배치.
5. 테스트 갱신: `place-map-panel-slide` · `place-map-view` · `plan-add-place-map` · `map-research-offset` · `token-usage`.
6. 1024 · 1280 · 1440 · 1920 headless 실측(D7) → `fe-reviewer` · `fe-map-reviewer` → PR.
