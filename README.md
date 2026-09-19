# WebVIEW-Generator

Standalone Android WebView application generator.

This repository is independent from WeFinance and WeMONEY. It contains a reusable Android WebView template and a generator CLI that creates a configured Android project from a website URL.

## Features

- Website URL configuration
- App name and package name
- WebViewClient navigation handling
- JavaScript support
- File upload support
- External URL handling
- Back navigation
- Pull-to-refresh
- Network error screen
- Configurable status/navigation bar colors
- Android project generation
- No dependency on WeFinance or WeMONEY

## Architecture

```
WebVIEW-Generator
├── generator/              # Standalone project generator
├── template/               # Android WebView template
├── generated/               # Local generated projects (gitignored)
└── README.md
```

The generated application is a normal Android Studio project. The generator does not embed or import any source code from the website being wrapped.

## Quick start

Requirements:
- Python 3.10+
- Android Studio / Android SDK
- JDK 17

Run:

```bash
python generator/generate.py \
  --url "https://example.com" \
  --name "Example App" \
  --package "com.example.app"
```

The generated project will be placed under `generated/<slug>`.

Then open that directory in Android Studio and build the APK.

## Security model

Only the configured website is loaded by the generated app. JavaScript is enabled because modern web applications commonly require it. Do not add a JavaScript bridge unless it is explicitly required; Android documents that JavaScript interfaces can create security risks when untrusted web content is involved.

## License

MIT
