#!/usr/bin/env sh
#
# 프로젝트 스코프 Claude Code 에이전트 정의(.claude/agents/*.md)를 검사한다.
#
# **왜 sh 인가** — Windows 개발 PC 에 Python 이 없을 수 있다(Microsoft Store 스텁만 있으면
# `python` 이 exit 49 로 죽는다). `.githooks/pre-push` 와 같은 런타임을 쓰면 어느 PC 에서든 돈다.
#
# 검사 항목:
#   1. UTF-8 BOM 금지 — Windows 기본이 CP949 라 여기서 한글이 깨진다
#   2. YAML frontmatter 존재, `name` / `description` 필수
#   3. `name` 이 파일명과 일치 — 어긋나면 호출은 되는데 문서와 다른 이름이라 조용히 헷갈린다
#   4. `model` 이 허용값인지
#   5. 읽기 전용 역할이 실제로 읽기 전용인지 — `tools` 누락은 전체 도구 상속(=쓰기 가능)이다
#
# 실행:
#   sh scripts/check-claude-agents.sh

set -e

repo_root=$(git rev-parse --show-toplevel)
agents_dir="$repo_root/.claude/agents"

allowed_models="fable opus sonnet haiku inherit"

# `tools` 를 생략하면 전체 도구를 상속한다 = 파일을 고칠 수 있다.
# 읽기 전용이어야 하는 역할은 반드시 `tools` 를 명시해야 한다.
read_only_roles="explorer architect bug-investigator reviewer
be-hexagonal-reviewer be-db-reviewer be-security-reviewer
fe-reviewer fe-api-contract fe-map-reviewer"

errors=0
count=0

fail() {
  echo "ERROR: $1" >&2
  errors=$((errors + 1))
}

contains() {
  # contains <haystack> <needle>
  for item in $1; do
    [ "$item" = "$2" ] && return 0
  done
  return 1
}

if [ ! -d "$agents_dir" ]; then
  fail "Not a directory: .claude/agents"
  exit 1
fi

for file in "$agents_dir"/*.md; do
  [ -e "$file" ] || continue
  count=$((count + 1))
  base=$(basename "$file" .md)
  rel=".claude/agents/$(basename "$file")"

  # 1. BOM
  if [ "$(head -c 3 "$file" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ]; then
    fail "UTF-8 BOM is not allowed: $rel"
    continue
  fi

  # 2. frontmatter — 1행이 `---` 이고 닫는 `---` 이 있어야 한다
  if [ "$(head -n 1 "$file" | tr -d '\r')" != "---" ]; then
    fail "Missing YAML frontmatter: $rel"
    continue
  fi
  fm_end=$(tail -n +2 "$file" | tr -d '\r' | grep -n '^---$' | head -n 1 | cut -d: -f1)
  if [ -z "$fm_end" ]; then
    fail "Unterminated YAML frontmatter: $rel"
    continue
  fi
  fm=$(tail -n +2 "$file" | head -n $((fm_end - 1)) | tr -d '\r')

  # 3. name
  name=$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | head -n 1 | tr -d '"'"'")
  if [ -z "$name" ]; then
    fail "Missing name: $rel"
  elif [ "$name" != "$base" ]; then
    fail "Name does not match filename: $rel: $name != $base"
  fi

  # 4. description
  if [ -z "$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -n 1)" ]; then
    fail "Missing description: $rel"
  fi

  # 5. model
  model=$(printf '%s\n' "$fm" | sed -n 's/^model:[[:space:]]*//p' | head -n 1 | tr -d '"'"'")
  if [ -n "$model" ] && ! contains "$allowed_models" "$model"; then
    fail "Unknown model: $rel: $model (allowed: $allowed_models)"
  fi

  # 6. 읽기 전용 역할의 도구 권한
  if contains "$(printf '%s' "$read_only_roles" | tr '\n' ' ')" "$base"; then
    tools=$(printf '%s\n' "$fm" | sed -n 's/^tools:[[:space:]]*//p' | head -n 1)
    if [ -z "$tools" ]; then
      fail "Read-only role must declare tools (omitting it inherits write access): $rel"
    else
      for banned in Write Edit NotebookEdit; do
        if printf '%s' "$tools" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -qx "$banned"; then
          fail "Read-only role has write tool '$banned': $rel"
        fi
      done
    fi
  fi
done

if [ "$count" -eq 0 ]; then
  fail "No agent definitions found under .claude/agents"
fi

if [ "$errors" -gt 0 ]; then
  echo "" >&2
  echo "check-claude-agents: $errors error(s)" >&2
  exit 1
fi

echo "check-claude-agents: OK ($count files)"
