# WebVIEW-Generator

Desktop-first generator untuk membuat **aplikasi Android WebView** dari sebuah URL.

Generator berjalan sebagai aplikasi desktop Windows/Linux/macOS, sedangkan hasil akhirnya tetap:
- Android Studio project
- Debug APK
- Release APK
- Release AAB
- Project ZIP

Project ini berdiri sendiri dan tidak bergantung pada source code, database, backend, atau AI configuration milik WeFinance maupun WeMONEY.

## Desktop Generator

```bash
python generator/generator_app.py
```

GUI menyediakan App Name, Package Name, Website URL, Version, Version Code, warna, splash, PNG launcher icon, JavaScript, File Upload, Pull-to-Refresh, External Links, Save/Load JSON, Generate Project, Build Debug APK, Build Release APK, Build Release AAB, Export Project ZIP, dan build console.

### Alur

```
Desktop Generator
      |
      v
Android Project
      |
      +--> Debug APK
      +--> Release APK
      +--> Release AAB
      +--> Project ZIP
```

Desktop GUI bukan aplikasi target. Ia hanya mengontrol generator dan Gradle/Android SDK.

## Requirements

- Python 3.10+
- JDK 17
- Android SDK
- Gradle (opsional jika project belum mempunyai wrapper)

## Build Windows EXE

```bash
pip install -r requirements-desktop.txt
pyinstaller --noconfirm --clean webview-generator.spec
```

Output: `dist/WebVIEW-Generator/`

## CLI

```bash
python generator/generate.py --url "https://example.com" --name "Example App" --package "com.example.app"
```

## Independence

WeFinance dan WeMONEY hanya dapat menjadi target URL; keduanya bukan dependency.

## CI

GitHub Actions memvalidasi generator Android dan workflow desktop membuat paket Windows melalui PyInstaller.

## License

MIT
