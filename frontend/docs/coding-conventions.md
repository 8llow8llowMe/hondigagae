# Frontend Coding Conventions

## 1. 네이밍

| 대상              | 규칙                      | 예                                             |
| ----------------- | ------------------------- | ---------------------------------------------- |
| 파일 / 디렉터리   | kebab-case                | `place-list-section.tsx`, `ai-plan/`           |
| 컴포넌트          | PascalCase                | `PlaceListSection`                             |
| 훅                | `use` + camelCase         | `usePlaceList`                                 |
| 타입 / 인터페이스 | PascalCase                | `PlaceDetail`, `SliceResponse`                 |
| 상수              | UPPER_SNAKE               | `PROTECTED_PATHS`                              |
| query key 팩토리  | `<domain>Keys`            | `placeKeys`, `planKeys`                        |
| API 함수          | 동사 + 대상               | `fetchPlaces`, `createPlan`, `replaceDayItems` |
| 테스트            | `*.test.ts` (`.tsx` 아님) | `classify-error.test.ts`                       |

- 백엔드 도메인 용어를 그대로 쓴다: `place`, `plan`, `pet`, `member`, `ai-plan`. 임의 번역을 만들지 않는다.
- 사용자 노출 용어는 `DESIGN.md` 용어 표를 따른다 (예: "반려견" 고정, "강아지" 혼용 금지).

## 2. 파일 구조

```ts
'use client' // 필요할 때만, 항상 최상단

import { useEffect } from 'react' // 1. react / next
import { useRouter } from 'next/navigation'

import { useQuery } from '@tanstack/react-query' // 2. 외부 패키지

import { Button } from '@/components/button' // 3. 내부 (@ = src)
import { fetchPlaces } from '@/lib/api/place'

import type { PlaceSummary } from '@/types/place' // 4. 타입 전용
```

- import 그룹 사이에 빈 줄 1개. 그룹 내부는 알파벳 순.
- 타입 전용 임포트는 `import type` 을 쓴다.
- 한 파일에 컴포넌트 1개를 기본으로 한다. 파일 안에서만 쓰는 작은 조각은 예외.
- export는 named export를 기본으로 한다 (`page.tsx`, `layout.tsx` 등 Next 규약은 default).

## 3. 타입 규칙

- **`any` 금지.** 계약이 불확실하면 `unknown` + 좁히기.
- **API 응답 타입은 `src/types/` 에 둔다.** 컴포넌트 파일에 인라인으로 선언하지 않는다.
- **ID 타입을 실물 기준으로 적는다.** `memberId` 는 `string`. 다른 ID는 Swagger로 개별 확인한다.
- nullable을 타입에 정직하게 반영한다. `T | null` 을 `T` 로 좁히지 않는다.
- 단위를 이름이나 주석에 남긴다.

```ts
type PlaceSummary = {
  placeId: string
  title: string
  distanceMeters: number | null // m 단위. 위치 미제공 시 null
}
```

- enum 값은 백엔드 문자열을 그대로 union 타입으로 쓴다. 표시 문구를 붙이지 않는다.

```ts
// 좋음 — 서버가 name/description 을 함께 내려준다
type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

// 금지 — 한국어 매핑 테이블. 백엔드 문구 변경 시 즉시 드리프트
const JOB_STATUS_LABEL = { PENDING: '대기 중', ... }
```

## 4. 서버 enum metadata를 그대로 렌더한다

백엔드는 상태·등급·추천 이유를 `{code, name, description, scoreDescription}` 로 내려준다.

- **`name` / `description` 을 그대로 출력한다.**
- FE는 **색·아이콘 매핑만** 가진다. 그때도 모르는 `code` 에 대한 기본값을 둔다.

```tsx
const TONE: Record<string, string> = { HIGH: 'text-brand-600', MEDIUM: 'text-warn-600' }
const tone = TONE[level.code] ?? 'text-fg-muted' // 기본값 필수

return <span className={tone}>{level.name}</span>
```

근거: `api-integration-guide.md` §6.

## 5. 금지 패턴

```ts
// 1) module scope / 컴포넌트 body 최상단에서 브라우저 API
const w = window.innerWidth
const t = localStorage.getItem('token')

// 2) 토큰을 클라이언트에 보관
localStorage.setItem('accessToken', token)

// 3) dataBody 직접 사용
const places = res.dataBody.contents // success 판별 누락

// 4) 클라이언트 코드에서 게이트웨이 직접 호출
fetch('http://localhost:8000/api/v1/places') // /api/bff 우회
// (서버 컴포넌트는 예외다. src/lib/api/server.ts 로 게이트웨이를 직접 부른다
//  — architecture-guide.md §8 "클라이언트가 둘이다")

// 5) ID를 숫자로
const id = Number(memberId)

// 6) any
function handle(data: any) {}

// 7) 없는 API 호출 (백엔드 미착수)
fetch('/api/bff/places/1/suitability')

// 8) cleanup 없는 effect
useEffect(() => {
  window.addEventListener('resize', fn)
}, [])

// 9) 디버그 잔재
console.log(response)
```

## 6. 에러·상태 렌더

모든 데이터 화면은 **4개 상태를 각각** 갖는다. 서로 배타적이어야 한다.

| 상태         | 표현                                                   |
| ------------ | ------------------------------------------------------ |
| loading      | skeleton (실제 콘텐츠와 크기 유사, 레이아웃 점프 없음) |
| empty / 404  | 안내 문구 + **다음 행동 제안**. **재시도 버튼 없음**   |
| 5xx / 무응답 | 에러 톤 + **재시도 버튼**                              |
| success      | 콘텐츠                                                 |

- `nullable` 섹션(데이터 없음)은 **에러가 아니라 숨김**이다.
- 판정 로직은 `src/lib/api/` 순수 함수로 뽑아 테스트한다.

## 7. 포맷·단위

- 단위 변환·표기는 `src/lib/format/` 에 모으고 함수 단위로 테스트한다.
- **화면에 단위를 드러낸다**: `24℃`, `도보 12분`, `1.2km`, `12,000원`.
- 거리는 1km 미만이면 m, 이상이면 소수 1자리 km.
- 날짜는 여행 맥락이므로 `2026.08.26 (수)` 형태를 기본으로 한다.

### 문구 템플릿 치환 (#1487)

- **사용자 입력이나 서버의 자유 텍스트**(일정 제목 · 반려견 이름 · 요청 문구 · 장소명 · 시설명 ·
  검색어 · 메모 · 준비물 이름 등)를 `messages` 템플릿에 넣을 때는 `src/lib/text/template.ts` 의
  `fillTemplate(template, { key: value })` 를 쓴다.
- `template.replace('{title}', title)` 처럼 **문자열을 두 번째 인자로 주지 않는다.** JS 가 값 안의
  `$&` · `$'` · `` $` `` · `$$` 를 치환 패턴으로 해석해, 요청 문구 `가격 $& 이하` 가
  `가격 {note} 이하` 로 찍힌다. `.replace().replace()` 연쇄는 앞 값에 든 `{time}` 같은 글자를
  뒤 치환이 다시 바꾸는 문제도 있다 — `fillTemplate` 은 한 번에 훑어 둘 다 막는다.
- 수(`String(n)`) · 형식화한 날짜 · 서버 enum `name` 처럼 `$` 가 들어갈 수 없는 값의 기존
  `.replace` 는 그대로 두었다. **lint 로 막지 않은 이유**: `.replace('{x}', 문자열)` 을 금지하면
  안전한 자리까지 300곳 · 100파일을 한 번에 바꿔야 해 병렬 브랜치와 충돌한다. 대신 `fillTemplate`
  단위 테스트와 화면 테스트(`ai-plan-job-frame.test.ts` · `trip-banner.test.ts`)로 지킨다.

## 8. 주석

- **왜 그렇게 했는지**를 적는다. 무엇을 하는지는 코드가 말한다.
- 백엔드 계약의 함정(nullable, 문자열 ID, 200+FAILED)은 짧은 주석으로 근거를 남긴다.
- 백엔드 미구현으로 임시 처리한 곳은 `TODO(BE): ...` 로 표시하고 `screen-inventory.md` 에도 남긴다.
- 주석 처리된 코드를 커밋하지 않는다.

## 9. 파일 인코딩

- **UTF-8 (no BOM), LF.** 루트 `.editorconfig`(ts/tsx 2-space)와 `.gitattributes` 가 강제한다.
- 이 설정 파일들을 덮어쓰지 않는다.
