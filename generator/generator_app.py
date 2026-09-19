#!/usr/bin/env python3
"""Standalone desktop UI for WebVIEW-Generator."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "generator" / "generate.py"
CONFIG_SCHEMA = ROOT / "generator" / "config_schema.json"


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return value or "webview-app"


class GeneratorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("WebVIEW Generator")
        self.geometry("720x620")
        self.minsize(650, 560)
        self.configure(padx=24, pady=24)

        self.app_name = tk.StringVar(value="My Web App")
        self.package_name = tk.StringVar(value="com.example.mywebapp")
        self.website_url = tk.StringVar(value="https://example.com")
        self.version_name = tk.StringVar(value="1.0.0")
        self.version_code = tk.IntVar(value=1)
        self.primary_color = tk.StringVar(value="#111827")
        self.splash_color = tk.StringVar(value="#111827")
        self.dark_mode = tk.BooleanVar(value=False)
        self.javascript = tk.BooleanVar(value=True)
        self.file_upload = tk.BooleanVar(value=True)
        self.pull_refresh = tk.BooleanVar(value=True)
        self.external_links = tk.BooleanVar(value=True)
        self.icon_path = tk.StringVar(value="")

        self._build_ui()

    def _build_ui(self) -> None:
        ttk.Label(self, text="WebVIEW Generator", font=("Segoe UI", 22, "bold")).pack(anchor="w")
        ttk.Label(
            self,
            text="Buat project Android WebView mandiri dari sebuah URL.",
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(4, 18))

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True)

        project = ttk.Frame(notebook, padding=18)
        appearance = ttk.Frame(notebook, padding=18)
        features = ttk.Frame(notebook, padding=18)
        notebook.add(project, text="Project")
        notebook.add(appearance, text="Appearance")
        notebook.add(features, text="WebView")

        self._field(project, "App Name", self.app_name, 0)
        self._field(project, "Package Name", self.package_name, 1)
        self._field(project, "Website URL", self.website_url, 2)
        self._field(project, "Version", self.version_name, 3)
        self._field(project, "Version Code", self.version_code, 4)

        self._field(appearance, "Primary Color", self.primary_color, 0)
        self._field(appearance, "Splash Color", self.splash_color, 1)
        ttk.Checkbutton(appearance, text="Dark mode", variable=self.dark_mode).grid(row=2, column=0, sticky="w", pady=8)
        ttk.Label(appearance, text="App Icon (optional)").grid(row=3, column=0, sticky="w", pady=(18, 4))
        ttk.Entry(appearance, textvariable=self.icon_path, width=48).grid(row=4, column=0, sticky="ew")
        ttk.Button(appearance, text="Browse", command=self.pick_icon).grid(row=4, column=1, padx=8)

        checks = [
            ("JavaScript", self.javascript),
            ("File Upload", self.file_upload),
            ("Pull to Refresh", self.pull_refresh),
            ("External Links", self.external_links),
        ]
        for i, (label, variable) in enumerate(checks):
            ttk.Checkbutton(features, text=label, variable=variable).pack(anchor="w", pady=8)

        bottom = ttk.Frame(self)
        bottom.pack(fill="x", pady=(18, 0))
        ttk.Button(bottom, text="Generate Project", command=self.generate).pack(side="right")
        ttk.Button(bottom, text="Save Config", command=self.save_config).pack(side="right", padx=8)

    def _field(self, parent, label, variable, row):
        parent.grid_columnconfigure(0, weight=1)
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=(0, 4))
        ttk.Entry(parent, textvariable=variable).grid(row=row, column=1, sticky="ew", pady=(0, 12), padx=(16, 0))

    def pick_icon(self):
        path = filedialog.askopenfilename(
            title="Select App Icon",
            filetypes=[("PNG images", "*.png"), ("All files", "*.*")]
        )
        if path:
            self.icon_path.set(path)

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
        return c

    def save_config(self):
        try:
            c = self.validate()
            path = filedialog.asksaveasfilename(
                defaultextension=".json",
                filetypes=[("JSON", "*.json")]
            )
            if path:
                Path(path).write_text(json.dumps(c, indent=2), encoding="utf-8")
                messagebox.showinfo("Saved", f"Configuration saved to:\n{path}")
        except Exception as exc:
            messagebox.showerror("Validation error", str(exc))

    def generate(self):
        try:
            c = self.validate()
            result = subprocess.run(
                [
                    sys.executable, str(GENERATOR),
                    "--url", c["website_url"],
                    "--name", c["app_name"],
                    "--package", c["package_name"],
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=True,
            )
            messagebox.showinfo("Generated", result.stdout.strip())
        except subprocess.CalledProcessError as exc:
            messagebox.showerror("Generator error", exc.stderr or exc.stdout)
        except Exception as exc:
            messagebox.showerror("Error", str(exc))


if __name__ == "__main__":
    GeneratorApp().mainloop()
