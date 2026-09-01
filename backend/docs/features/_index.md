# 백엔드 기능 이슈 초안 인덱스

> GitHub 이슈로 올리기 전의 초안을 여기 남긴다. 이슈 본문은 그대로 복사해 쓴다.
> 이슈 단위·브랜치 네이밍 기준은 루트 `docs/git-workflow.md` 가 정본이다.

## 왜 남기는가

이슈는 GitHub 에 올라가면 검색은 되지만 **저장소를 클론한 상태에서는 보이지 않는다.**
설계 판단의 근거가 이슈 본문에만 있으면 코드를 읽는 사람이 그것을 찾지 못한다.

그래서 규모가 있거나 판단이 갈렸던 작업은 초안을 저장소에 남긴다. 이슈가 닫혀도 근거는 남는다.

## 작성 규칙

- 파일명: `<번호미정이면 draft>-<영문 kebab 요약>.md`
- 이슈를 올린 뒤 파일명 앞에 이슈 번호를 붙인다 (`draft-` -> `12-`)
- 본문은 `.github/ISSUE_TEMPLATE/feature-issue.md` 구조를 그대로 쓴다
- **작업이 끝나면 지우지 않는다.** 설계 문서(`docs/*.md`)로 승격할 내용이 있으면 옮기고,
  이슈 초안 자체는 "그때 무엇을 몰랐는지"의 기록으로 남긴다

## 목록

| 파일 | 이슈 | 상태 | 요약 |
| --- | --- | --- | --- |
| `draft-mid-term-forecast.md` | 미등록 | 구현 완료 | 중기예보 연동으로 예보 커버리지 3일 -> 11일 |
| `draft-redis-sentinel-wiring.md` | 미등록 | 구현 완료 | Sentinel 접속 배선, 설정 누락 기동 실패 |
| `draft-forecast-quota-defense.md` | 미등록 | 구현 완료 | 예보 캐시 쿼터 방어 3종 |
| `draft-excluded-from-conventions-refactor.md` | 미등록 | 후보 | 컨벤션 리팩토링에서 의도적으로 뺀 4건 |

### 사후 초안에 대해

`draft-mid-term-forecast` / `draft-redis-sentinel-wiring` / `draft-forecast-quota-defense`
는 **구현이 먼저 들어간 뒤에 쓴 초안**이다. `git-workflow.md` 의 "이슈 → 브랜치 → 작업"
순서와 반대다. 한 브랜치에 세 기능을 담은 뒤 PR 의 `Issue Number` 를 채우려다 보니 이렇게 됐다.

기록으로 남기는 이유는 이 순서가 반복되면 안 되기 때문이다. 이슈를 먼저 쪼갰으면 브랜치도
셋으로 갈렸을 테고, 커밋을 나중에 기능별로 되돌려 쪼개는 일도 없었을 것이다.
