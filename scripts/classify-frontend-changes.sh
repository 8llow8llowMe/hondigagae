#!/usr/bin/env sh
#
# 변경 파일 목록을 보고 프론트엔드 검사를 얼마나 돌릴지 정한다 (#1004).
#
# **CI(`.github/workflows/frontend-ci.yml` 의 `changes` 잡)와 `.githooks/pre-push` 가 같이 쓴다.**
# 기준이 두 곳에 따로 있으면 한쪽만 고쳐져, 로컬은 건너뛰는데 CI 는 도는(또는 그 반대) 일이 생긴다.
#
# 입력(stdin): 저장소 루트 기준 경로, 한 줄에 하나
# 출력(stdout): 셋 중 하나
#   code — 아래 docs 가 아닌 `frontend/` 파일이 바뀌었거나 frontend-ci 워크플로가 바뀌었다 → 전부 돈다
#   docs — `frontend/docs/**`(그림 포함)와 그 밖의 `frontend/**/*.md` 만 바뀌었다 → `format:check` 만 돈다
#   none — 프론트엔드와 무관하다
#
# **`frontend/DESIGN.md` 는 문서지만 `code` 다.** 대비비 · 토큰 테스트가 그 파일을 읽어 선언과
# 실측을 대조한다 (`src/test/tokens.ts`). 테스트가 읽는 문서가 늘면 여기에 더한다.
#
# **문서만 바뀌어도 `format:check` 는 남긴다.** `.md` 도 prettier 대상이고, #282 는 백엔드 PR 이
# 프론트 문서 하나를 포맷 없이 고쳐 develop 을 빨갛게 만든 사고였다.
#
# 실행:
#   git -c core.quotepath=off diff --name-only origin/develop...HEAD | sh scripts/classify-frontend-changes.sh
#
# **`core.quotepath=off` 를 꼭 준다.** 기본값이면 git 이 한글 경로를 `"frontend/docs/\354..."` 처럼
# 따옴표로 감싸 내보내 아래 패턴에 걸리지 않는다. 그렇게 들어온 경로는 무엇인지 모르므로 `code` 로 본다.

set -e

kind=none
# 마지막 줄에 줄바꿈이 없어도 읽는다 — `printf %s` 로 넘기면 끝 줄이 버려진다
while IFS= read -r path || [ -n "$path" ]; do
  case "$path" in
    .github/workflows/frontend-ci.yml | frontend/DESIGN.md)
      kind=code
      ;;
    frontend/docs/* | frontend/*.md)
      [ "$kind" = none ] && kind=docs
      ;;
    frontend/* | \"frontend/*)
      kind=code
      ;;
  esac
done

echo "$kind"
