# 산책 코스 목록 — 계약 회귀 · 레이아웃 인계 명세

- 작성일: 2026-09-21
- 시안: [`2026-09-21-walk-course-list-mockups.html`](./2026-09-21-walk-course-list-mockups.html) · 발행본 <https://claude.ai/code/artifact/17933854-bb46-4d19-a7a3-0d64cb1272fb>
- 출발 이슈: [#826](https://github.com/8llow8llowMe/hondigagae/issues/826) (진입·이탈 동선)
- 이 문서의 목적: **다른 PC · 다른 세션에서 그대로 이어 가기.** 무엇을 실측했고, 무엇을 정했고, 어디부터 손대면 되는지를 한 곳에 둔다.

---

## 1. 한 줄 요약

#826 을 확인하러 들어갔다가 **그 이슈의 전제가 이미 무너져 있었고**, 목록 화면에는 **계약 회귀 1건과 UI 버그 3건**이 별도로 있었다. 아직 코드는 한 줄도 고치지 않았다 — 시안과 이 문서뿐이다.

---

## 2. 실측 (2026-09-21 · dev 게이트웨이 · 로컬 백엔드 미기동)

```bash
curl -s "https://api-dev.hondigagae.com/api/v1/walk-courses"
curl -s "https://api-dev.hondigagae.com/api/v1/walk-courses?petActivityLevel=LOW"
```

### 2-1. 데이터 분포가 뒤집혔다

| 항목                 | 진단 시점 (2026-09-18) | **2026-09-21**     |
| -------------------- | ---------------------- | ------------------ |
| 시작점 좌표          | 4 / 29                 | **29 / 29**        |
| 대표 이미지          | 4 / 29                 | **29 / 29**        |
| `durationMaxMinutes` | (필드 없음)            | **29 / 29 채워짐** |

`#722`(좌표 재적재)가 dev 에 이미 반영됐다는 뜻이다. 이 한 줄이 아래 두 결정을 동시에 바꾼다.

### 2-2. 응답 계약이 바뀌었는데 FE 가 옛 필드를 본다 — **회귀**

BE 커밋 `12f9f069` (`[BE] feat: 올레 코스 조회 응답에 상한·소요·적합도를 함께 내린다`) 에서:

```jsonc
// 지금 dev 응답
{
  "courses": [...],
  "totalCount": 6,
  "appliedPetActivityLevel": {
    "level": { "code": "LOW", "name": "낮음", "description": "짧은 산책을 선호하며..." },
    "maxDurationMinutes": 240
  },
  "providerName": "..."
}
// `petActivityLevelApplied` (boolean) 는 **사라졌다**
```

FE 는 아직 `data?.petActivityLevelApplied === true` 를 본다 (`walk-course-list-view.tsx`). 그래서:

- **`?activity=LOW` 로 목록이 29 → 6 개로 줄어드는데 기준 줄이 한 줄도 뜨지 않는다.** 왜 줄었는지 화면이 말하지 않는다 (재현: `/walk-courses?activity=LOW`)
- `noGoldenInScope` 안내(`basisApplied` 로 켜진다)도 같이 죽어 있다
- `lib/walk-course/activity.ts` 의 `ACTIVITY_MAX_HOURS` 는 스스로 "서버 상한의 복제본" 이라고 적어 뒀는데, 이제 서버가 `maxDurationMinutes` 를 내려 준다 — 복제본을 지울 수 있다

### 2-3. 상세 응답에도 필드가 늘었다 (회귀는 아님 — 기회다)

`GET /walk-courses/{id}` 실응답 키:

```text
walkCourseId courseLabel name distanceKm durationText durationMaxMinutes
startEndPoint startPointName endPointName          ← 시종점이 갈려서 온다
lat lng endLat endLng                              ← 종점 좌표가 생겼다
firstImage baseDate fitsActivityLevels providerName
```

FE 의 `WalkCourseDetail` 은 아직 `WalkCourseSummary & { baseDate, providerName }` 라 **다섯 필드를 모른다.** 넘치는 필드는 무시되므로 깨지지는 않지만, 두 가지가 새로 가능해졌다:

- `startPointName` / `endPointName` — `코스목록-세부명세.md` **D4-4**("원문을 갈라 재조립하지 않는다")의 이유가 "FE 가 하이픈으로 자르면 잘못 갈린다" 였다. **서버가 갈라서 준다면 그 제약이 사라진다**
- `endLat` / `endLng` — 시작점만 있던 때는 못 그리던 **코스 전체 동선**을 지도에 올릴 수 있다. #826 의 "코스 상세 → 시작점 근처 장소" 후보와 직접 맞물린다

### 2-4. UI 버그 3건 (1440 / 1180 / 375 실측)

| #   | 증상                                                             | 원인                                                                                                                                           | 위치                                            |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| U1  | 세그먼트 라벨이 `4시간 ...` 으로 잘린다 (md 이상 전부)           | `SegmentOption` 이 `flex-1`(= `flex: 1 1 0%`) 이라 칸을 **균등 분배**한다. `전체`(24px)가 65px 를 쓰고 `4시간 이내`(61px)가 49px 칸에 들어간다 | `walk-course-filter-fields.tsx`                 |
| U2  | `활동량` · `정렬` 라벨이 카드 인셋 밖(x=0, 나머지 콘텐츠는 x=16) | `Surface` 의 `tools` 슬롯은 **자기 인셋을 스스로 들어야 한다**(surface.tsx 주석). 코스 목록의 tools 래퍼에 `INSET_CLASS.card` 가 없다          | `walk-course-list-view.tsx`                     |
| U3  | 1280+ 에서 표의 약 60%가 빈 공간                                 | 그리드가 `minmax(0,1fr) 5rem 6rem minmax(0,1fr) 5rem 1.25rem`. 1350px 행에서 코스 열 487px · 시종점 열 487px 인데 실제 글자는 각 150px 남짓    | `.walk-course-row-grid` (`app/globals.css:652`) |

---

## 3. 내린 결정

| 결정                                                | 이유                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **목록을 사진 카드 그리드로 다시 그린다 (안 A)**    | 텍스트 표를 고른 근거(`코스목록-세부명세.md` D1-1)가 "이미지 4/29" 였는데 지금 29/29 다. **근거가 사라졌으므로 결정도 다시 한다**                                                                                                               |
| **번호 강조는 A4 — 번호 왼쪽, 구간명 오른쪽 한 줄** | 사진 위에 아무것도 얹지 않아 사진 밝기와 무관하게 대비가 유지된다. `3코스 (A)` · `7-1코스` 같은 변칙 이름표가 배지 폭에 눌리지 않는다. 실측: 1280+ 3열에서 29개 전부 한 줄, 375px 에서 `7-1코스 서귀포버스터미널-제주올레여행자센터` 하나만 2줄 |
| 열 수는 1 / 2(768+) / 3(1280+)                      | `U3` 의 빈 공간이 열 수로 해소된다. 좌측 필터 레일을 두지 않는다는 D1 은 그대로                                                                                                                                                                 |
| **작업을 두 갈래로 쪼갠다 — 계약 회귀가 먼저**      | #826 은 "동선" 이슈다. 계약 회귀·UI 버그를 거기 끼워 넣으면 제목과 내용이 어긋나고 PR 이 30파일 규약을 넘긴다                                                                                                                                   |
| 사용자 결정: A 안 채택, 번호를 더 잘 보이게         | 시안 A1(사진 위 배지) · A2(번호가 첫 줄) · A3(사진에 걸친 칩) 을 함께 보고 **A4** 를 고름                                                                                                                                                       |
| 백엔드는 건드리지 않는다                            | FE 전용 작업이다. 계약 실측은 읽기만 한다                                                                                                                                                                                                       |

---

## 4. 남은 것 — 우선순위 순

### ① 새 이슈 — 계약 회귀 + 목록 UI (아직 이슈 없음, **먼저 만들어야 한다**)

제목안: `[FE] fix: 산책 코스 목록이 적용된 활동량을 다시 말하게 한다`

- [ ] `WalkCourseList` 타입에서 `petActivityLevelApplied` 제거, `appliedPetActivityLevel` 추가
      (`{ level: { code, name, description }, maxDurationMinutes: number | null } | null`)
- [ ] `walk-course-list-view.tsx` 의 `applied` / `basis` 판정을 새 필드로 옮긴다.
      **null 셋을 가른다** (BE 커밋 메시지 기준): 객체가 `null` = 활동량으로 거르지 않음 /
      객체는 있고 `maxDurationMinutes` 가 `null` = HIGH(상한 없음) / 코스의 `durationMaxMinutes` 가
      `null` = **원문 파싱 실패**("제한 없음" 이 아니다)
- [ ] 기준 줄의 상한 숫자 출처를 `ACTIVITY_MAX_HOURS` → 서버 `maxDurationMinutes` 로 바꾸고,
      쓰이지 않게 된 상수/테스트 고정값을 지운다 (`lib/walk-course/activity.ts`)
- [ ] `U1` — `SegmentOption` 의 `flex-1` 을 내용 폭 존중으로 (`flex: 1 1 auto` 계열). 라벨 잘림 회귀 테스트
- [ ] `U2` — tools 래퍼에 `INSET_CLASS.card`
- [ ] `U3` + 레이아웃 — `WalkCourseRow` 를 A4 카드로 교체, `WalkCourseColumnHead` 와
      `.walk-course-row-grid`(globals.css) **삭제**, `WalkCourseRowSkeleton` 을 카드 모양으로
- [ ] `코스목록-세부명세.md` D1-1 을 다시 쓴다 — **"이미지 4/29 라 텍스트 행" 근거가 무효**가 된
      경위와 실측일을 남긴다. `공통명세.md` S3-1 의 4/29 서술도 같이
- [ ] 테스트: 기준 줄이 `appliedPetActivityLevel` 로 그려지는 것, 카드 마크업.
      **범위 넓은 클래스 단언은 false-green 이 되기 쉬우니 여는 태그로 범위를 좁힌다**

### ② #826 — 진입·이탈 동선

좌표 29/29 가 되어 이슈가 미뤄 뒀던 후보가 **전부 열렸다.** 이슈에 실측을 코멘트로 남기고 자리를 고른다.

- [ ] #826 에 코멘트: 좌표 4/29 → 29/29, 이미지 4/29 → 29/29 (2026-09-21 dev 실측). `#722` 선행조건 해소
- [ ] 이을 자리를 **한두 개만** 고른다 (이슈 본문 지시). 지금 열린 후보:
      장소 상세 → 근처 코스 / 코스 상세 → 시작점 근처 장소 / 일정 상세 → 코스 찾으러 가기 /
      홈 배너 문구를 대표견 조건과 잇기
- [ ] `공통명세.md` S6-1 갱신 — 그 표는 **"배너가 유일한 상시 진입점"** 을 전제로 쓰여 있다
- [ ] 진입 링크 계약을 `walk-course-entry.test.ts` 로 못박는다

---

## 5. 주의사항

- **브랜치 · PR**: 이 문서와 시안은 `docs/fe/826-walk-course-list-layout` 에 올렸다. 위 ①은 **새 이슈를 먼저 만들고** 거기서 브랜치를 딴다 (`이슈 없이 브랜치를 만들지 않는다`). Jenkins PR 은 base 가 `develop` 이어야 한다
- **작업 트리를 다른 세션과 공유한다.** `git add -A` / `git add .` / 맨 `git stash` 를 쓰지 않는다 — 경로를 하나씩 스테이징한다
- **로컬 백엔드가 안 뜬다.** 계약 실측은 `https://api-dev.hondigagae.com` 로만 했다. 로컬 기동 절차는 `backend/docs/local-run-guide.md`
- **vitest 는 Node 20.12+ 가 필요하다.** 기본이 v20.10.0 이면 `pnpm verify` 가 막힌다
- **워크트리에서 `preview_start` 는 메인 체크아웃의 `launch.json` 을 읽는다.** 워크트리 dev 서버는 직접 띄우고 (`pnpm -C frontend dev:alt2`, 5175) URL 로 붙인다
- 시안을 로컬에서 보려면 `frontend/docs/superpowers/specs/2026-09-21-walk-course-list-mockups.html` 을 브라우저로 직접 연다. 데이터는 파일 안에 박혀 있어 서버가 필요 없다 (이미지는 TourAPI 원격)
- 시안 HTML 은 **artifact 호환 조각**이다 (`<!doctype>` · `<html>` · `<head>` · `<body>` 없음) — `2026-09-15-ui-ux-audit-mockups.html` 과 같은 형식
- 상세 응답의 새 필드 5종(§2-3)은 **타입에 아직 없다.** ①의 범위 밖이지만, `startPointName`/`endPointName` 은 D4-4 결정을 되돌릴 근거가 되고 `endLat`/`endLng` 는 #826 의 지도 후보를 연다 — ② 착수 때 같이 본다
- `fitsActivityLevels` 가 상세에 온다. 목록 카드에 "우리 아이한테 맞아요" 류 표시를 붙일 재료지만 **목록 응답에는 없다** — 붙이려면 BE 에 요청해야 한다 (FE 전용 작업이므로 이슈로)
