#!/usr/bin/env python3
"""Full desktop GUI for WebVIEW-Generator."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "generator" / "generate.py"
OUTPUT_ROOT = ROOT / "generated"


class GeneratorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("WebVIEW Generator")
        self.geometry("900x720")
        self.minsize(820, 650)
        self.configure(padx=22, pady=18)

        self.app_name = tk.StringVar(value="My Web App")
        self.package_name = tk.StringVar(value="com.example.mywebapp")
        self.website_url = tk.StringVar(value="https://example.com")
        self.version_name = tk.StringVar(value="1.0.0")
        self.version_code = tk.StringVar(value="1")
        self.primary_color = tk.StringVar(value="#111827")
        self.splash_color = tk.StringVar(value="#111827")
        self.dark_mode = tk.BooleanVar(value=False)
        self.javascript = tk.BooleanVar(value=True)
        self.file_upload = tk.BooleanVar(value=True)
        self.pull_refresh = tk.BooleanVar(value=True)
        self.external_links = tk.BooleanVar(value=True)
        self.icon_path = tk.StringVar(value="")
        self.output_dir = tk.StringVar(value=str(OUTPUT_ROOT))
        self.last_project = tk.StringVar(value="")

        self._build_ui()

    def _build_ui(self) -> None:
        header = ttk.Frame(self)
        header.pack(fill="x")
        ttk.Label(header, text="WebVIEW Generator", font=("Segoe UI", 24, "bold")).pack(anchor="w")
        ttk.Label(
            header,
            text="Generate • Brand • Build APK/AAB • Standalone Android WebView",
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(3, 14))

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True)

        project = ttk.Frame(notebook, padding=18)
        appearance = ttk.Frame(notebook, padding=18)
        features = ttk.Frame(notebook, padding=18)
        build = ttk.Frame(notebook, padding=18)
        notebook.add(project, text="Project")
        notebook.add(appearance, text="Appearance")
        notebook.add(features, text="WebView")
        notebook.add(build, text="Build")

        self._field(project, "App Name", self.app_name, 0)
        self._field(project, "Package Name", self.package_name, 1)
        self._field(project, "Website URL", self.website_url, 2)
        self._field(project, "Version", self.version_name, 3)
        self._field(project, "Version Code", self.version_code, 4)
        self._field(project, "Output Folder", self.output_dir, 5)
        ttk.Button(project, text="Browse", command=self.pick_output).grid(row=5, column=2, padx=(8, 0))
        ttk.Label(project, text="Target URL can be any compatible HTTPS/HTTP website.").grid(
            row=6, column=1, columnspan=2, sticky="w", pady=(6, 0)
        )

        self._field(appearance, "Primary Color", self.primary_color, 0)
        self._field(appearance, "Splash Color", self.splash_color, 1)
        ttk.Checkbutton(appearance, text="Force WebView dark mode", variable=self.dark_mode).grid(
            row=2, column=1, sticky="w", pady=8
        )
        ttk.Label(appearance, text="Launcher Icon (PNG, optional)").grid(
            row=3, column=0, sticky="w", pady=(18, 4)
        )
        ttk.Entry(appearance, textvariable=self.icon_path).grid(row=3, column=1, sticky="ew", padx=12)
        ttk.Button(appearance, text="Browse", command=self.pick_icon).grid(row=3, column=2)
        ttk.Label(
            appearance,
            text="Custom PNG is copied into the generated APK. Without one, a built-in icon is used.",
            wraplength=600,
        ).grid(row=4, column=1, columnspan=2, sticky="w", pady=(8, 0))
        appearance.grid_columnconfigure(1, weight=1)

        checks = [
            ("JavaScript", self.javascript),
            ("File Upload", self.file_upload),
            ("Pull to Refresh", self.pull_refresh),
            ("External Links / Custom Schemes", self.external_links),
        ]
        for i, (label, variable) in enumerate(checks):
            ttk.Checkbutton(features, text=label, variable=variable).pack(anchor="w", pady=9)
        ttk.Label(
            features,
            text="These switches are compiled into the generated Android app.",
            wraplength=650,
        ).pack(anchor="w", pady=(14, 0))

        ttk.Label(build, text="Build output", font=("Segoe UI", 12, "bold")).pack(anchor="w")
        self.log = tk.Text(build, height=22, wrap="word", state="disabled")
        self.log.pack(fill="both", expand=True, pady=(8, 12))
        buttons = ttk.Frame(build)
        buttons.pack(fill="x")
        ttk.Button(buttons, text="Generate Project", command=self.generate).pack(side="left")
        ttk.Button(buttons, text="Build Debug APK", command=lambda: self.build("debug")).pack(side="left", padx=8)
        ttk.Button(buttons, text="Build Release APK", command=lambda: self.build("release")).pack(side="left")
        ttk.Button(buttons, text="Build Release AAB", command=lambda: self.build("bundle")).pack(side="left", padx=8)
        ttk.Button(buttons, text="Open Output", command=self.open_output).pack(side="right")

        bottom = ttk.Frame(self)
        bottom.pack(fill="x", pady=(14, 0))
        ttk.Button(bottom, text="Save Config", command=self.save_config).pack(side="right")
        ttk.Button(bottom, text="Load Config", command=self.load_config).pack(side="right", padx=8)

    def _field(self, parent, label, variable, row):
        parent.grid_columnconfigure(1, weight=1)
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=(0, 10))
        ttk.Entry(parent, textvariable=variable).grid(
            row=row, column=1, sticky="ew", pady=(0, 10), padx=(16, 0)
        )

    def pick_icon(self):
        path = filedialog.askopenfilename(
            title="Select Launcher Icon",
            filetypes=[("PNG images", "*.png")],
        )
        if path:
            self.icon_path.set(path)

    def pick_output(self):
        path = filedialog.askdirectory(title="Select Output Folder")
        if path:
            self.output_dir.set(path)

    def config(self):
        return {
            "app_name": self.app_name.get().strip(),
            "package_name": self.package_name.get().strip(),
            "website_url": self.website_url.get().strip(),
            "version_name": self.version_name.get().strip(),
            "version_code": int(self.version_code.get()),
            "theme": {
                "primary_color": self.primary_color.get().strip(),
                "splash_color": self.splash_color.get().strip(),
                "dark_mode": self.dark_mode.get(),
            },
            "features": {
                "javascript": self.javascript.get(),
                "file_upload": self.file_upload.get(),
                "pull_to_refresh": self.pull_refresh.get(),
                "external_links": self.external_links.get(),
            },
            "icon_path": self.icon_path.get().strip(),
        }

    def validate(self):
        c = self.config()
        if not c["app_name"]:
            raise ValueError("App Name wajib diisi.")
        if not re.match(r"^https?://", c["website_url"], re.I):
            raise ValueError("Website URL harus diawali http:// atau https://.")
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$", c["package_name"]):
            raise ValueError("Package Name Android tidak valid.")
        if not re.match(r"^#[0-9a-fA-F]{6}$", c["theme"]["primary_color"]):
            raise ValueError("Primary Color harus format #RRGGBB.")
        if not re.match(r"^#[0-9a-fA-F]{6}$", c["theme"]["splash_color"]):
            raise ValueError("Splash Color harus format #RRGGBB.")
        if c["version_code"] < 1:
            raise ValueError("Version Code harus >= 1.")
        if c["icon_path"] and not Path(c["icon_path"]).is_file():
            raise ValueError("File icon tidak ditemukan.")
        return c

    def save_config(self):
        try:
            c = self.validate()
            path = filedialog.asksaveasfilename(
                defaultextension=".json",
                filetypes=[("JSON", "*.json")],
            )
            if path:
                Path(path).write_text(json.dumps(c, indent=2), encoding="utf-8")
                self.write_log(f"Config saved: {path}")
        except Exception as exc:
            messagebox.showerror("Validation error", str(exc))

    def load_config(self):
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if not path:
            return
        try:
            c = json.loads(Path(path).read_text(encoding="utf-8"))
            self.app_name.set(c.get("app_name", ""))
            self.package_name.set(c.get("package_name", ""))
            self.website_url.set(c.get("website_url", ""))
            self.version_name.set(c.get("version_name", "1.0.0"))
            self.version_code.set(str(c.get("version_code", 1)))
            theme = c.get("theme", {})
            self.primary_color.set(theme.get("primary_color", "#111827"))
            self.splash_color.set(theme.get("splash_color", "#111827"))
            self.dark_mode.set(bool(theme.get("dark_mode", False)))
            features = c.get("features", {})
            self.javascript.set(bool(features.get("javascript", True)))
            self.file_upload.set(bool(features.get("file_upload", True)))
            self.pull_refresh.set(bool(features.get("pull_to_refresh", True)))
            self.external_links.set(bool(features.get("external_links", True)))
            self.icon_path.set(c.get("icon_path", ""))
            self.write_log(f"Config loaded: {path}")
        except Exception as exc:
            messagebox.showerror("Load error", str(exc))

    def write_log(self, message: str):
        self.log.configure(state="normal")
        self.log.insert("end", message + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _config_file(self, config: dict) -> Path:
        temp = ROOT / "generator" / ".active_config.json"
        temp.write_text(json.dumps(config, indent=2), encoding="utf-8")
        return temp

    def generate(self, show_message: bool = True) -> bool:
        try:
            c = self.validate()
            output = Path(self.output_dir.get()).expanduser().resolve() / re.sub(
                r"[^a-zA-Z0-9]+", "-", c["app_name"].strip()
            ).strip("-").lower()
            output.parent.mkdir(parents=True, exist_ok=True)
            config_path = self._config_file(c)
            command = [sys.executable, str(GENERATOR), "--config", str(config_path), "--output", str(output)]
            self.write_log("$ " + " ".join(command))
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            if result.stdout:
                self.write_log(result.stdout.strip())
            if result.returncode != 0:
                self.write_log(result.stderr.strip())
                raise RuntimeError(result.stderr.strip() or "Generator failed")
            self.last_project.set(str(output))
            self.write_log(f"PROJECT READY: {output}")
            if show_message:
                messagebox.showinfo("Generated", f"Project generated successfully:\n{output}")
            return True
        except Exception as exc:
            if show_message:
                messagebox.showerror("Generator error", str(exc))
            self.write_log("ERROR: " + str(exc))
            return False

    def _gradle_command(self, project: Path) -> list[str]:
        if os.name == "nt":
            wrapper = project / "gradlew.bat"
            if wrapper.exists():
                return [str(wrapper)]
        else:
            wrapper = project / "gradlew"
            if wrapper.exists():
                return [str(wrapper)]
        gradle = shutil.which("gradle")
        if not gradle:
            raise RuntimeError("Gradle wrapper/Gradle tidak ditemukan. Install Gradle atau gunakan GitHub Actions.")
        subprocess.run([gradle, "wrapper", "--gradle-version", "8.13"], cwd=project, check=True)
        return [str(project / ("gradlew.bat" if os.name == "nt" else "gradlew"))]

    def build(self, kind: str):
        def worker():
            if not self.generate(show_message=False):
                return
            project = Path(self.last_project.get())
            try:
                cmd = self._gradle_command(project)
                task = {"debug": "assembleDebug", "release": "assembleRelease", "bundle": "bundleRelease"}[kind]
                self.write_log(f"BUILD START: {task}")
                process = subprocess.Popen(
                    cmd + [task],
                    cwd=project,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
                for line in process.stdout or []:
                    self.write_log(line.rstrip())
                code = process.wait()
                if code != 0:
                    raise RuntimeError(f"Gradle build failed with exit code {code}")
                self.write_log(f"BUILD SUCCESS: {task}")
                if kind == "bundle":
                    artifact = project / "app" / "build" / "outputs" / "bundle" / "release"
                elif kind == "release":
                    artifact = project / "app" / "build" / "outputs" / "apk" / "release"
                else:
                    artifact = project / "app" / "build" / "outputs" / "apk" / "debug"
                self.write_log(f"ARTIFACT: {artifact}")
                self.after(0, lambda: messagebox.showinfo("Build complete", f"Build berhasil:\n{artifact}"))
            except Exception as exc:
                self.write_log("BUILD ERROR: " + str(exc))
                self.after(0, lambda: messagebox.showerror("Build error", str(exc)))

        threading.Thread(target=worker, daemon=True).start()

    def open_output(self):
        path = Path(self.last_project.get() or self.output_dir.get()).expanduser().resolve()
        path.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])


if __name__ == "__main__":
    GeneratorApp().mainloop()
