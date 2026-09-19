# WebVIEW-Generator

Standalone Android WebView application generator.

This repository is independent from WeFinance and WeMONEY. It does not import their source code, database, backend configuration, or AI configuration.

## What it does

WebVIEW-Generator turns a website URL into a configurable Android Studio WebView project.

### Generator UI

Launch the desktop generator:

```bash
python generator/generator_app.py
```

The UI provides:

- App Name
- Android Package Name
- Website URL
- Version / Version Code
- Primary Color
- Splash Color
- Dark Mode
- Optional App Icon selection
- JavaScript toggle
- File Upload toggle
- Pull-to-Refresh toggle
- External Link toggle
- Save configuration as JSON
- Generate Android project

### CLI

The generator can also be used without the UI:

```bash
python generator/generate.py \
  --url "https://example.com" \
  --name "Example App" \
  --package "com.example.app"
```

Generated projects are written to `generated/<slug>`.

## Android template

The generated application includes:

- Android WebView
- JavaScript
- DOM Storage
- Cookies
- File upload
- Back navigation
- Pull-to-refresh
- HTTP/HTTPS navigation
- External scheme handling
- Lifecycle cleanup
- Android API 24+ support

## CI/CD

GitHub Actions validates the generator, creates a sample project, builds a debug APK, and uploads the APK as an artifact.

Workflow:

```
.github/workflows/build.yml
```

## Independence

WebVIEW-Generator is a standalone tool.

```
WebVIEW-Generator
       |
       +-- Website A -> APK
       +-- Website B -> APK
       +-- WeFinance -> APK
       +-- WeMONEY -> APK
       +-- Any compatible website -> APK
```

WeFinance and WeMONEY are targets that may be wrapped by URL; they are not dependencies of this repository.

## Requirements

- Python 3.10+
- Android Studio / Android SDK
- JDK 17
- Gradle is installed automatically by the GitHub Actions workflow; local Android builds use the generated Gradle wrapper.

## License

MIT
