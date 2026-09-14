#!/usr/bin/env sh
#
# 머지된 PR 과 그 PR 이 참조한 이슈의 상태가 어긋난 곳을 찾는다.
#
# **왜 필요한가** — 이 저장소는 `Closes #N` 자동 닫기를 쓰지 않는다. 부분 완료 이슈가
# 조용히 닫히는 것을 막기 위한 의도적 선택이고, 그 근거는 `docs/git-workflow.md`
# "머지 후 이슈 갱신" 절에 실측과 함께 적혀 있다 (#150).
#
# 대신 정리가 **사람 손**에 남는다. 체크리스트에 적어 두는 것만으로는 새어나간다 —
# #596 이 PR #597 머지 후 체크박스 7개를 전부 미체크로 남긴 채 열려 있었다.
# 이 스크립트는 막지 않고 **보이게 한다.**
#
# 무엇을 보는가:
#   머지된 PR 의 `Issue Number: #N` 을 모아, 그 이슈가 아직 열려 있으면
#   체크박스 진행률과 함께 출력한다. 체크된 항목이 0개면 "정리 누락 의심" 으로 표시한다.
#
# **열려 있다고 전부 잘못은 아니다.** 부분 완료는 열려 있는 것이 맞다 — 그래서 이 스크립트는
# 판단하지 않고 대조표만 내놓는다. 판단은 사람이 한다.
#
# 실행:
#   sh scripts/check-issue-sync.sh          # 최근 머지 PR 100건
#   sh scripts/check-issue-sync.sh 200      # 개수 지정

set -e

limit=${1:-100}

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI 가 필요하다 (https://cli.github.com)" >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# 열린 이슈 번호
gh issue list --state open --limit 300 --json number -q '.[].number' | sort -u > "$work/open"

# 머지 PR → 참조 이슈. 같은 이슈를 여러 PR 이 참조하면 PR 번호를 모은다.
gh pr list --state merged --limit "$limit" --json number,body \
  -q '.[] | [.number, ((.body // "") | capture("Issue Number:\\s*#(?<n>[0-9]+)") | .n)] | @tsv' \
  2>/dev/null | sort -t"$(printf '\t')" -k2,2n > "$work/refs" || true

found=0

while IFS="$(printf '\t')" read -r issue; do
  [ -n "$issue" ] || continue

  prs=$(awk -F"$(printf '\t')" -v n="$issue" '$2 == n { printf "#%s ", $1 }' "$work/refs")

  body=$(gh issue view "$issue" --json title,body -q '.title + "\n" + .body')
  title=$(printf '%s\n' "$body" | head -1)
  boxes=$(printf '%s\n' "$body" | grep -c '^\s*- \[[ x]\]' || true)
  done_boxes=$(printf '%s\n' "$body" | grep -c '^\s*- \[x\]' || true)

  if [ "$boxes" -gt 0 ] && [ "$done_boxes" -eq 0 ]; then
    mark="  <- 정리 누락 의심 (체크된 항목이 하나도 없다)"
  else
    mark=""
  fi

  printf '#%s  [%s/%s]  %s  (PR %s)%s\n' \
    "$issue" "$done_boxes" "$boxes" "$title" "$prs" "$mark"
  found=$((found + 1))
done <<EOF2
$(awk -F"$(printf '\t')" '{ print $2 }' "$work/refs" | sort -un | while read -r n; do
    grep -qx "$n" "$work/open" && echo "$n"
  done)
EOF2

echo
if [ "$found" -eq 0 ]; then
  echo "머지 PR 이 참조한 이슈 중 열려 있는 것이 없다."
else
  echo "열린 이슈 ${found}건. 부분 완료면 열려 있는 것이 맞다 — 체크박스가 실제 완료 여부대로"
  echo "갱신돼 있는지 확인하고, 전부 끝났으면 닫는다 (docs/git-workflow.md \"머지 후 이슈 갱신\")."
fi
