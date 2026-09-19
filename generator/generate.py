#!/usr/bin/env python3
"""Generate a standalone Android WebView project from a JSON configuration."""

from __future__ import annotations

import argparse
import json
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


def validate_hex(value: str, field: str) -> str:
    if not re.match(r"^#[0-9a-fA-F]{6}$", value):
        raise ValueError(f"{field} must use #RRGGBB")
    return value.upper()


def validate_version_code(value) -> int:
    value = int(value)
    if value < 1:
        raise ValueError("version_code must be >= 1")
    return value


def validate_version_name(value: str) -> str:
    value = str(value).strip()
    if not value or not re.match(r"^[0-9A-Za-z][0-9A-Za-z._+-]*$", value):
        raise ValueError("version_name contains invalid characters")
    return value


def replace_tokens(path: Path, values: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(key, value)
    path.write_text(text, encoding="utf-8")


def load_config(args: argparse.Namespace) -> dict:
    if args.config:
        config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    else:
        config = {
            "app_name": args.name,
            "package_name": args.package,
            "website_url": args.url,
            "version_name": args.version_name,
            "version_code": args.version_code,
            "theme": {
                "primary_color": args.primary_color,
                "splash_color": args.splash_color,
                "dark_mode": args.dark_mode,
            },
            "features": {
                "javascript": not args.no_javascript,
                "file_upload": not args.no_file_upload,
                "pull_to_refresh": not args.no_pull_to_refresh,
                "external_links": not args.no_external_links,
            },
            "icon_path": args.icon_path or "",
        }

    config.setdefault("theme", {})
    config.setdefault("features", {})
    config["app_name"] = str(config.get("app_name", "")).strip()
    config["package_name"] = str(config.get("package_name", "")).strip()
    config["website_url"] = str(config.get("website_url", "")).strip()
    config["version_name"] = validate_version_name(config.get("version_name", "1.0.0"))
    config["version_code"] = validate_version_code(config.get("version_code", 1))
    config["theme"]["primary_color"] = validate_hex(
        str(config["theme"].get("primary_color", "#111827")), "Primary Color"
    )
    config["theme"]["splash_color"] = validate_hex(
        str(config["theme"].get("splash_color", "#111827")), "Splash Color"
    )
    config["theme"]["dark_mode"] = bool(config["theme"].get("dark_mode", False))
    for key in ("javascript", "file_upload", "pull_to_refresh", "external_links"):
        config["features"][key] = bool(config["features"].get(key, True))
    config["icon_path"] = str(config.get("icon_path", "")).strip()

    if not config["app_name"]:
        raise ValueError("app_name is required")
    validate_url(config["website_url"])
    validate_package(config["package_name"])
    return config



def find_android_sdk() -> Path | None:
    import os
    candidates = []
    for name in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        value = os.environ.get(name, "").strip()
        if value:
            candidates.append(Path(value).expanduser())
    home = Path.home()
    candidates.extend([home / "AppData" / "Local" / "Android" / "Sdk", home / "Android" / "Sdk", home / "Library" / "Android" / "sdk"])
    if os.name == "nt":
        candidates.extend([Path("C:/Android/Sdk"), Path("C:/Users/Public/Android/Sdk")])
    seen = set()
    for sdk in candidates:
        if not sdk.is_dir():
            continue
        try:
            key = str(sdk.resolve()).lower()
        except OSError:
            key = str(sdk).lower()
        if key in seen:
            continue
        seen.add(key)
        if (sdk / "platform-tools").is_dir() and ((sdk / "platforms").is_dir() or (sdk / "build-tools").is_dir()):
            return sdk.resolve()
    return None


def write_local_properties(destination: Path) -> None:
    sdk = find_android_sdk()
    if sdk is None:
        raise RuntimeError("Android SDK tidak ditemukan. Set ANDROID_HOME/ANDROID_SDK_ROOT atau instal Android SDK, lalu generate ulang project.")
    (destination / "local.properties").write_text(f"sdk.dir={sdk.as_posix()}\n", encoding="utf-8")
    print(f"Android SDK: {sdk}")

def copy_icon(config: dict, destination: Path) -> None:
    icon_target = destination / "app" / "src" / "main" / "res" / "drawable" / "ic_launcher.png"
    icon_target.parent.mkdir(parents=True, exist_ok=True)
    icon_path = Path(config.get("icon_path", ""))

    if icon_path and icon_path.is_file():
        if icon_path.suffix.lower() != ".png":
            raise ValueError("App Icon must be a PNG file")
        shutil.copy2(icon_path, icon_target)
        (destination / "app" / "src" / "main" / "res" / "drawable" / "ic_launcher.xml").unlink(missing_ok=True)
    else:
        fallback = destination / "app" / "src" / "main" / "res" / "drawable" / "ic_launcher.xml"
        if not fallback.exists():
            raise ValueError("Template launcher icon is missing")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate an Android WebView project")
    parser.add_argument("--config", default=None, help="Path to generator JSON configuration")
    parser.add_argument("--url", default="https://example.com")
    parser.add_argument("--name", default="WebVIEW App")
    parser.add_argument("--package", default="com.example.webviewapp")
    parser.add_argument("--version-name", default="1.0.0")
    parser.add_argument("--version-code", type=int, default=1)
    parser.add_argument("--primary-color", default="#111827")
    parser.add_argument("--splash-color", default="#111827")
    parser.add_argument("--dark-mode", action="store_true")
    parser.add_argument("--no-javascript", action="store_true")
    parser.add_argument("--no-file-upload", action="store_true")
    parser.add_argument("--no-pull-to-refresh", action="store_true")
    parser.add_argument("--no-external-links", action="store_true")
    parser.add_argument("--icon-path", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    config = load_config(args)
    slug = slugify(config["app_name"])
    destination = Path(args.output).resolve() if args.output else OUTPUT_ROOT / slug

    if destination.exists():
        shutil.rmtree(destination)

    shutil.copytree(TEMPLATE, destination)

    java_root = destination / "app" / "src" / "main" / "java"
    activities = list(java_root.rglob("MainActivity.kt"))
    if len(activities) != 1:
        raise ValueError(f"Expected exactly one MainActivity.kt in template, found {len(activities)}")

    source_activity = activities[0]
    actual_package_path = java_root / Path(config["package_name"].replace(".", "/"))
    actual_package_path.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source_activity), str(actual_package_path / "MainActivity.kt"))

    feature = config["features"]
    values = {
        "__APP_NAME__": config["app_name"].replace("&", "&amp;"),
        "__APP_URL__": config["website_url"].replace("&", "&amp;"),
        "__PACKAGE_NAME__": config["package_name"],
        "__VERSION_NAME__": config["version_name"],
        "__VERSION_CODE__": str(config["version_code"]),
        "__PRIMARY_COLOR__": config["theme"]["primary_color"],
        "__SPLASH_COLOR__": config["theme"]["splash_color"],
        "__DARK_MODE__": "true" if config["theme"]["dark_mode"] else "false",
        "__JAVASCRIPT__": "true" if feature["javascript"] else "false",
        "__FILE_UPLOAD__": "true" if feature["file_upload"] else "false",
        "__PULL_REFRESH__": "true" if feature["pull_to_refresh"] else "false",
        "__EXTERNAL_LINKS__": "true" if feature["external_links"] else "false",
    }

    for path in destination.rglob("*"):
        if path.is_file() and path.suffix in {".kt", ".xml", ".gradle", ".kts", ".properties", ".md"}:
            replace_tokens(path, values)

    copy_icon(config, destination)
    write_local_properties(destination)

    print(f"Generated Android project: {destination}")
    print(f"Package: {config['package_name']}")
    print(f"Version: {config['version_name']} ({config['version_code']})")
    print(f"Icon: {'custom PNG' if Path(config.get('icon_path', '')).is_file() else 'template fallback'}")


if __name__ == "__main__":
    main()
