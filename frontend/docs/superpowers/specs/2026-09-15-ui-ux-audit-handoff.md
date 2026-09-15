# UI/UX 진단 후속 작업 인계 명세

- 작성일: 2026-09-15 (Sprint A 머지 직후)
- 진단 정본: [`2026-09-15-ui-ux-audit-design.md`](./2026-09-15-ui-ux-audit-design.md) · 시안 [`2026-09-15-ui-ux-audit-mockups.html`](./2026-09-15-ui-ux-audit-mockups.html)
- 이 문서의 목적: **다른 PC · 다른 세션에서 Sprint B 부터 그대로 이어 가기.** 무엇이 끝났고, 무엇이 남았고, 어떤 방식으로 진행했는지를 한 곳에 둔다.

---

## 1. 끝난 것 (Sprint A)

| 이슈 | PR   | 내용                                                                                                          | 머지    |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------- | ------- |
| #636 | #644 | 홈 기준 장소 없을 때 대표 지점(사라봉공원 `126454`) 판정 · 온보딩 행 주 버튼 · 모바일 로그인 링크 (H-1 · H-4) | develop |
| #637 | #645 | 골든타임 헤드라인 배지 제거 · 창 안 등급 분포 문장 (H-2)                                                      | develop |
| #638 | #646 | 권역 점수 `100점` + 만점 캡션 · 동점 문장 · score 배지 padding 12→8 (H-3)                                     | develop |
| #639 | #647 | 긴급 시설 기본 보기 목록 · 위치 primary 버튼 · 4권역 세그먼트 (E-1 · E-2)                                     | develop |
| #640 | #648 | 진단 명세서 · 시안 · 명세 인덱스 · **이 인계 문서**                                                           | develop |

세부명세 정본은 각 레인이 가져갔다: `docs/features/home/홈-첫방문-판정-세부명세.md` · `골든타임-문구-세부명세.md` · `권역-점수-라벨-세부명세.md` · `docs/features/emergency/긴급시설-목록우선-세부명세.md`.

### 구현 중 내린 결정 (진단 문서 §6 에 없는 것)

| 결정                                                                         | 이유                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| score 배지 padding 12 → 8 (`metric.tsx`)                                     | `100점` 세 자리에서 390px 숫자 칸 여유가 0.63px — 접힘 직전. 8 로 내려 8.63px 회복 |
| 긴급 시설 데스크톱 부제는 개수 한 줄만                                       | 둘째 줄 `10.0km` 가 홀로 떠 뜻이 안 읽혔다. 반경은 레일과 요약 줄이 이미 말한다    |
| 홈 로그인 라벨은 `global-header.tsx` 상수 하나로 공유 (message 키 아님)      | 기존 데스크톱도 리터럴. 키로 올리면 회원가입까지 옮겨야 해 범위 초과 → Sprint D    |
| 홈 캡션은 `pickedBasisPlaceId === null && isDefaultBasis(id)` 일 때만        | 사용자가 실제로 사라봉공원을 본 경우 "장소를 보면 바뀌어요" 가 거짓이 된다         |
| 긴급 시설 `regionCode` 는 URL 에 두지 않는다                                 | 기준점은 필터가 아니라 세션 맥락. 공유 URL 이 남의 위치를 실어 나르지 않는다       |
| `EmergencySection` prop 을 `positionFallback` → `basis`/`regionCode` 로 교체 | `showDistance` 가 `'region'` 에서 true 여야 하는데 옛 prop 으로는 표현 불가        |

---

## 2. 남은 것 — 우선순위 순

진단 문서 §4 의 Sprint B~D 그대로. 각 줄이 이슈 1개다. **이슈 제목은 그대로 쓰면 된다.**

### Sprint B — 위계 · 어휘 (P1)

| #    | 이슈 제목                                                                                 | 진단 ID                   | 주로 고치는 곳                                                                               | 시안      |
| ---- | ----------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- | --------- |
| 6    | `[FE] feat: 장소 상세 모바일 상단에 판정 요약 3줄을 두고 액션을 하단 고정 바로 옮긴다`    | D-1 · D-4                 | `features/place/**` 상세 뷰, 갤러리 높이 200                                                 | §2        |
| 7    | `[FE] feat: 혼잡도 집중률을 정수·상대 표현으로 바꾼다`                                    | D-3                       | 혼잡도 차트 컴포넌트 (`place-congestion`)                                                    | §2 ④      |
| 8    | `[FE] feat: 등급 배지에 축 라벨을 붙여 혼잡도와 적합도를 가른다`                          | G-1 · D-2                 | `components/metric.tsx` `MetricBadge` + 호출부. **서버 enum name 은 그대로, 앞에 축 라벨만** | §2 ② · §6 |
| 9    | `[FE] refactor: 일정 상세 헤더에서 상태 변경을 메뉴로 내리고 준비물을 일차 아래로 옮긴다` | PL-2 · PL-3 · PL-4 · PL-5 | `features/plan/**` 상세 (`plan-status-action.tsx` 는 develop 에서 최근 바뀜 — 먼저 읽을 것)  | §4        |
| 10   | `[FE] feat: 긴급 시설 필터를 진료중 우선으로 재배열하고 영업시간을 오늘 한 줄로 접는다`   | E-3 · E-4                 | `emergency-filter-fields.tsx` · `facility-row.tsx`                                           | §3 ③ ④    |
| 10-b | `[FE] feat: 긴급 시설 지도 클러스터 알약을 숫자 원형 마커로 바꾼다`                       | E-1 후반                  | `emergency-map-*` — **`fe-map-reviewer` 검토 필수**                                          | §3 ①      |
| 10-c | `[FE] fix: 골든타임 곡선의 추천 구간 면을 시각별 등급으로 칠한다`                         | H-2 잔여                  | `walk-times-section.tsx` `HourlyCurve` (홈-세부명세 D4-1-c 갱신)                             | —         |

### Sprint C — 전환 · 밀도 (P1)

| #   | 이슈 제목                                                                       | 진단 ID         | 시안 |
| --- | ------------------------------------------------------------------------------- | --------------- | ---- |
| 11  | `[FE] feat: 반려견 등록을 2단계로 나누고 필드별 효과 힌트를 붙인다`             | PT-1            | §5   |
| 12  | `[FE] feat: 장소 목록 행에 동반 상태 칩과 지연 조회 적합도를 붙인다`            | P-1 · P-2 · P-3 | §6   |
| 13  | `[FE] feat: 일정 목록 카드에 요약 줄과 반려견 아바타를 붙인다`                  | PL-1            | §7   |
| 14  | `[FE] feat: AI 일정 폼에 "AI 가 보는 것" 칩과 조건 미리보기를 둔다`             | AI-1 · AI-3     | §7   |
| 15  | `[FE] fix: 저장한 장소에서 사라진 장소를 사용자 언어로 말하고 해제 버튼을 둔다` | F-1             | —    |

### Sprint D — 다듬기 (P2 묶음, 이슈 1~2개로)

소셜 로그인 우선 배치(A-1 · A-2, §8) · 하단 탭 응급 5탭(G-3) · 숫자 정수화(G-2: `26.0℃`→`26℃`) · 소개 페이지 3단(AB-1 — **#635 가 이미 열려 있다**, 겹치니 그 이슈에 합친다) · 헤더 로그인·회원가입 라벨 message 키 이전 · 마이페이지 로그아웃 위계(M-1) · 반려견 삭제 버튼 위계(PT-3) · 일정 예산 통화 접미(PL-6) · 저장 한도 안내 조건(F-2).

### 미확인 화면 (진단 §1-3)

AI 생성 진행(`/ai-plans/jobs/[jobId]`) · 일자 장소 추가/재생성 · 소셜 콜백 · 비밀번호 변경/탈퇴. **실화면을 보지 못했다.** Sprint C-14 착수 전에 진행 화면을 먼저 캡처해 AI-2 등급을 다시 매긴다.

---

## 3. 진행 방식 (그대로 반복하면 된다)

### 3-1. 명세 → 이슈 → 레인

1. 레인마다 세부명세 1개 (`_DocumentTemplates/_template-세부명세.md` D0~D9). **같은 파일을 고치는 항목은 한 레인으로 묶는다** (Sprint A 에서 H-1+H-4 를 묶은 이유).
2. 이슈는 `gh issue create --label frontend-web --assignee @me`, 본문은 `.github/ISSUE_TEMPLATE/feature-issue.md` 형식.
3. 레인 워크트리: `git worktree add -b <type>/fe/<이슈번호>-<요약> .claude/worktrees/fe-<번호>-<요약> origin/develop`. 각 워크트리에 `frontend/.env.local` 복사 + `pnpm install --frozen-lockfile`.
4. `_index.md` 는 레인이 건드리지 않는다 — 인덱스 행은 DOCS PR 하나가 맡는다.

### 3-2. 에이전트 배치

- 구현은 `fe-implementer`(Opus) 를 **레인마다 1개, 한 메시지에서 병렬 호출**. 프롬프트에 워크트리 절대경로 · 브랜치 · 명세 경로 · e2e 포트(레인마다 다르게, 5181~) · 커밋 규칙(경로별 `git add`, `[FE] type: … (#n)`, Co-Authored-By, push 금지) · 보고 형식을 적는다.
- **Opus 세션 한도**가 걸리면 에이전트가 429 로 죽는다. 코드는 워크트리에 남으니 한도가 풀린 뒤 **같은 에이전트에 SendMessage 로 재개**한다 (새로 띄우면 읽기 비용을 다시 낸다). 토큰이 걱정되면 작은 레인(문구·라벨)은 `crud-implementer`(Sonnet) 로.
- 검토는 별도 `fe-reviewer` 를 띄우는 대신 메인 세션이 `git diff <merge-base>..HEAD` 를 직접 보고 목 서버 스크린샷 1~2장으로 판단했다 — 토큰 절약. 큰 레인이면 `fe-reviewer` 를 쓴다.
- `git diff origin/develop..HEAD` 가 남의 변경까지 보이면 develop 이 움직인 것이다. `merge-base` 기준으로 본다.

### 3-3. 검증 · 화면 확인

- 로그인 이후 화면은 실계정 없이: 메인 체크아웃 `frontend/` 에서 `MOCK_API=true NEXT_DIST_DIR=.next-e2e ./node_modules/.bin/next dev -p 5175` → `E2E_PORT=5175 ./node_modules/.bin/playwright test --project=setup` → `e2e/.auth/user.json` 으로 Playwright 스크립트.
- 레인 워크트리에서 화면을 보려면 `MOCK_API=true NEXT_DIST_DIR=.next-check next dev -p 518x`. **끝나면 `tsconfig.json` 을 되돌리고 `.next-check` 를 지운다** — Next dev 가 tsconfig 를 자동으로 고쳐 rebase 를 막는다.
- 홈 `지금 산책 판정` 은 이제 첫 방문자에게도 보인다. 안 보이면 대표 지점 404 (`basis-place.ts`) 를 의심한다.
- 5174 는 사람이 쓰는 dev 서버다. 죽이지도, 재사용하지도 않는다.

### 3-4. PR · 머지

- push 직전 각 레인을 `git rebase origin/develop` (develop 이 자주 움직인다). pre-push 훅이 테스트를 돈다.
- `gh pr create --base develop --label frontend-web --assignee @me --body-file <템플릿 채운 파일>`. 본문 마지막 줄 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- CI 는 `verify` · `e2e` · `label` · `jenkins/pr-merge` 4개. e2e 는 job 단위로 확인한다.
- 머지는 `gh pr merge --rebase --delete-branch`. DOCS(인덱스) PR 은 링크가 비지 않게 **마지막**.
- 머지 후 로컬 워크트리 정리: `git worktree remove .claude/worktrees/fe-<번호>-*` + `git branch -d`.

---

## 4. 다음 세션이 첫 30분에 할 일

1. `git fetch && git log --oneline -10 origin/develop` 으로 Sprint A 5건이 머지됐는지 확인.
2. 이 문서 §2 Sprint B 의 6 · 8 · 9 · 10 을 먼저 명세로 쓴다 (P1 중 사용자 영향이 크고 서로 파일이 겹치지 않는 넷). 7 은 8 과 같은 차트 컴포넌트를 건드릴 수 있어 8 뒤에.
3. 6 을 쓰기 전에 `/places/[placeId]` 를 390 으로 다시 캡처한다 — 진단 이후 develop 에 후기(#634 · fc1bb5e5) 가 들어와 상세 하단이 바뀌었을 수 있다.
4. 9 를 쓰기 전에 `plan-status-action.tsx` · `plan/공통명세.md` 최신 버전을 읽는다 — Sprint A 진행 중 `plan-status-action-panel` 이 지워지고 완료·복제 기능이 들어왔다.

## 5. 이 PC 에 남은 로컬 상태

- 워크트리 `.claude/worktrees/fe-636-*` · `fe-637-*` · `fe-638-*` · `fe-639-*` — 머지 후 지워도 된다.
- 진단 스크린샷 71장과 캡처 스크립트는 세션 스크래치패드(임시)에만 있다. 재현은 §3-3 로.
- 시안 아티팩트(웹): https://claude.ai/artifact/8ep3D9155zg9V5M6zhz3k1 — 저장소의 HTML 과 같은 내용.
