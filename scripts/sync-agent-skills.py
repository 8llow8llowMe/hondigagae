from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
CANONICAL_ROOT = REPOSITORY_ROOT / ".agents" / "skills"
CLAUDE_ROOT = REPOSITORY_ROOT / ".claude" / "skills"
UTF8_BOM = b"\xef\xbb\xbf"


def relative_files(root: Path) -> dict[Path, Path]:
    return {
        path.relative_to(root): path
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts
    }


def validate_skill_files(root: Path) -> list[str]:
    errors: list[str] = []
    skill_files = sorted(root.rglob("SKILL.md"))
    if not skill_files:
        return [f"No SKILL.md files found under {root}"]

    for path in skill_files:
        raw = path.read_bytes()
        relative = path.relative_to(REPOSITORY_ROOT)
        if raw.startswith(UTF8_BOM):
            errors.append(f"UTF-8 BOM is not allowed: {relative}")
            continue
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            errors.append(f"Invalid UTF-8: {relative}: {error}")
            continue

        frontmatter = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.DOTALL)
        if frontmatter is None:
            errors.append(f"Missing YAML frontmatter: {relative}")
            continue

        metadata = frontmatter.group(1)
        name_match = re.search(r"^name:\s*[\"']?([^\"'\r\n]+)[\"']?\s*$", metadata, re.MULTILINE)
        description_match = re.search(r"^description:\s*.+$", metadata, re.MULTILINE)
        if name_match is None:
            errors.append(f"Missing name: {relative}")
        elif name_match.group(1).strip() != path.parent.name:
            errors.append(
                f"Name does not match directory: {relative}: "
                f"{name_match.group(1).strip()} != {path.parent.name}"
            )
        if description_match is None:
            errors.append(f"Missing description: {relative}")

        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            if target.startswith(("http://", "https://", "#")):
                continue
            target_path = (path.parent / target).resolve()
            if not target_path.exists():
                errors.append(f"Broken local link: {relative}: {target}")

    return errors


def sync_mirror() -> list[str]:
    errors: list[str] = []
    source_files = relative_files(CANONICAL_ROOT)
    destination_files = relative_files(CLAUDE_ROOT)

    extras = sorted(destination_files.keys() - source_files.keys())
    if extras:
        errors.extend(f"Refusing to delete mirror-only file: {path}" for path in extras)
        return errors

    for relative, source in source_files.items():
        destination = CLAUDE_ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    return errors


def check_mirror() -> list[str]:
    errors: list[str] = []
    canonical_files = relative_files(CANONICAL_ROOT)
    claude_files = relative_files(CLAUDE_ROOT)

    missing = sorted(canonical_files.keys() - claude_files.keys())
    extras = sorted(claude_files.keys() - canonical_files.keys())
    errors.extend(f"Missing Claude mirror file: {path}" for path in missing)
    errors.extend(f"Claude mirror-only file: {path}" for path in extras)

    for relative in sorted(canonical_files.keys() & claude_files.keys()):
        if canonical_files[relative].read_bytes() != claude_files[relative].read_bytes():
            errors.append(f"Mirror content differs: {relative}")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize and validate project Agent Skills mirrors."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="Copy canonical skills to Claude.")
    mode.add_argument("--check", action="store_true", help="Validate without changing files.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    if args.write:
        errors.extend(sync_mirror())

    errors.extend(validate_skill_files(CANONICAL_ROOT))
    errors.extend(validate_skill_files(CLAUDE_ROOT))
    errors.extend(check_mirror())

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("Agent Skills mirror and UTF-8 validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
