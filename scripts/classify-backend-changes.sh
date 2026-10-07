#!/usr/bin/env sh
#
# 변경 파일 목록을 보고 백엔드 Gradle 검사 범위를 정한다 (#1211).
#
# `.github/workflows/backend-ci.yml` 의 check 잡이 **PR 에서만** 쓴다. develop push 는 이 판정을 거치지 않고
# 언제나 전 모듈을 돈다 — 머지된 develop 을 검사하고 base 스코프 캐시를 채우는 실행이라 좁히면 안 된다(#830).
#
# 입력(stdin): 저장소 루트 기준 경로, 한 줄에 하나
# 출력(stdout): 한 줄
#   check                 — 전 모듈. core · 빌드 설정 · backend-ci 워크플로 · 이 스크립트가 바뀌었거나 모르는 경로가 있다
#   :service:<x>:check …  — 바뀐 서비스 · cloud 모듈만 (공백으로 구분, 이름순)
#   none                  — 백엔드 코드와 무관하다 (`backend/docs/**` · `backend/*.md` 만 바뀌었거나 백엔드 밖)
#
# **서비스는 좁혀도 되지만 core 는 안 된다.** 서비스 모듈끼리는 컴파일 의존이 없다(`project(':service:…')` 참조
# 0건). core 는 서비스 전부가 쓴다 — `common-core` 의 `GeoDistance` 하나가 tour · batch · ai 에 걸린다. 그래서
# `backend/core/**` 는 문서(.md)라도 전 모듈이다 — 리소스로 읽히는지 여기서 가릴 수 없다.
#
# **디렉터리가 곧 모듈이다.** `backend/service/<x>` 는 `settings.gradle` 의 `service:<x>` 다. 모듈 목록을 여기
# 적지 않는 이유다 — `.github/labeler.yml` · `Jenkinsfile-*` · `settings.gradle` 에 이어 네 번째 사본이 되고,
# 넷이 어긋나는 날 조용히 덜 돈다. 그 디렉터리가 없으면(모듈을 지운 PR) 무엇을 돌지 모르므로 전 모듈로 본다.
#
# **PR 라벨을 읽지 않는다.** 결과는 자동 라벨(`labeler.yml`, 같은 디렉터리 기준)과 같은 모듈이지만, `label` 잡과
# check 잡이 PR 을 열 때 동시에 시작해 라벨이 아직 없을 수 있다. core PR 에는 배포할 서비스 라벨을 사람이 더하므로
# 라벨이 곧 바뀐 모듈도 아니다.
#
# 실행 (저장소 루트에서 — 모듈 디렉터리가 있는지 본다):
#   git -c core.quotepath=off diff --name-only origin/develop...HEAD | sh scripts/classify-backend-changes.sh
#
# **`core.quotepath=off` 를 꼭 준다.** 기본값이면 git 이 한글 경로를 `"backend/docs/\354..."` 처럼 따옴표로 감싸
# 내보낸다. 그렇게 들어온 경로는 무엇인지 모르므로 전 모듈로 본다.

set -e

full=false
modules=""
# 마지막 줄에 줄바꿈이 없어도 읽는다 — `printf %s` 로 넘기면 끝 줄이 버려진다
while IFS= read -r path || [ -n "$path" ]; do
  case "$path" in
    '')
      ;;
    .github/workflows/backend-ci.yml | scripts/classify-backend-changes.sh)
      full=true
      ;;
    backend/service/*/* | backend/cloud/*/*)
      group=${path#backend/}   # service/ai-service/src/...
      kind=${group%%/*}        # service
      rest=${group#*/}         # ai-service/src/...
      name=${rest%%/*}         # ai-service
      if [ -d "backend/$kind/$name" ]; then
        modules="$modules :$kind:$name:check"
      else
        full=true
      fi
      ;;
    backend/core/*)
      full=true
      ;;
    backend/docs/* | backend/*.md)
      ;;
    backend/* | \"backend/*)
      full=true
      ;;
  esac
done

if [ "$full" = true ]; then
  echo check
elif [ -n "$modules" ]; then
  # 같은 모듈이 여러 파일로 들어온다 — 한 번만, 이름순으로
  printf '%s\n' $modules | sort -u | tr '\n' ' ' | sed 's/ $//'
  echo
else
  echo none
fi
