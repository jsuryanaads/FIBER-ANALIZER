#!/usr/bin/env python3
"""Generate a standalone Android WebView project from the repository template."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "template"
OUTPUT_ROOT = ROOT / "generated"


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return value or "webview-app"


def validate_url(url: str) -> str:
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise ValueError("URL must start with http:// or https://")
    return url


def validate_package(package: str) -> str:
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$", package):
        raise ValueError("Invalid Android package name")
    return package


def replace_tokens(path: Path, values: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(key, value)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate an Android WebView project")
    parser.add_argument("--url", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    url = validate_url(args.url)
    package = validate_package(args.package)
    slug = slugify(args.name)
    destination = Path(args.output).resolve() if args.output else OUTPUT_ROOT / slug

    if destination.exists():
        shutil.rmtree(destination)

    shutil.copytree(TEMPLATE, destination)

    package_path = destination / "app" / "src" / "main" / "java" / "com" / "example" / "webviewgenerator"
    actual_package_path = destination / "app" / "src" / "main" / "java" / Path(package.replace(".", "/"))
    actual_package_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(package_path / "MainActivity.kt"), str(actual_package_path / "MainActivity.kt"))
    shutil.rmtree(package_path, ignore_errors=True)

    values = {
        "__APP_NAME__": args.name,
        "__APP_URL__": url,
        "__PACKAGE_NAME__": package,
    }

    for path in destination.rglob("*"):
        if path.is_file() and path.suffix in {".kt", ".xml", ".gradle", ".kts", ".properties", ".md"}:
            replace_tokens(path, values)

    print(f"Generated Android project: {destination}")
    print("Open the generated directory in Android Studio and build the APK.")


if __name__ == "__main__":
    main()
