#!/usr/bin/env python3
"""Desktop GUI for WebVIEW-Generator.

The desktop application is only the generator/build controller. Its output remains
an Android Studio project plus APK/AAB artifacts.
"""
from __future__ import annotations
import json, os, queue, re, shutil, subprocess, sys, threading, urllib.request
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from zipfile import ZIP_DEFLATED, ZipFile

GRADLE_VERSION="8.13"
GRADLE_URL=f"https://services.gradle.org/distributions/gradle-{GRADLE_VERSION}-bin.zip"

ROOT=Path(__file__).resolve().parents[1]
GENERATOR=ROOT/"generator"/"generate.py"
DEFAULT_OUTPUT=ROOT/"generated"

class GeneratorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("WebVIEW Generator — Desktop")
        self.geometry("980x760"); self.minsize(900,680)
        self.configure(padx=20,pady=16)
        self.app_name=tk.StringVar(value="My Web App")
        self.package_name=tk.StringVar(value="com.example.mywebapp")
        self.website_url=tk.StringVar(value="https://example.com")
        self.version_name=tk.StringVar(value="1.0.0"); self.version_code=tk.StringVar(value="1")
        self.primary_color=tk.StringVar(value="#111827"); self.splash_color=tk.StringVar(value="#111827")
        self.dark_mode=tk.BooleanVar(value=False); self.javascript=tk.BooleanVar(value=True)
        self.file_upload=tk.BooleanVar(value=True); self.pull_refresh=tk.BooleanVar(value=True)
        self.external_links=tk.BooleanVar(value=True); self.icon_path=tk.StringVar()
        self.output_dir=tk.StringVar(value=str(DEFAULT_OUTPUT))
        self.last_project=None; self.events=queue.Queue(); self.busy=False
        self._build_ui(); self.after(100,self._drain_events)

    def _build_ui(self):
        header=ttk.Frame(self); header.pack(fill="x")
        ttk.Label(header,text="WebVIEW Generator",font=("Segoe UI",24,"bold")).pack(anchor="w")
        ttk.Label(header,text="Desktop generator • Android WebView • Build APK / AAB",font=("Segoe UI",10)).pack(anchor="w",pady=(3,14))
        nb=ttk.Notebook(self); nb.pack(fill="both",expand=True)
        project,appearance,features,build=[ttk.Frame(nb,padding=18) for _ in range(4)]
        for frame,title in zip((project,appearance,features,build),("Project","Appearance","WebView","Build")): nb.add(frame,text=title)
        for row,(label,var) in enumerate([("App Name",self.app_name),("Package Name",self.package_name),("Website URL",self.website_url),("Version",self.version_name),("Version Code",self.version_code),("Output Folder",self.output_dir)]):
            self._field(project,label,var,row)
        ttk.Button(project,text="Browse",command=self.pick_output).grid(row=5,column=2,padx=(8,0))
        ttk.Label(project,text="Hasil: Android Studio project → APK/AAB").grid(row=6,column=1,columnspan=2,sticky="w",pady=(4,0))
        self._field(appearance,"Primary Color",self.primary_color,0); self._field(appearance,"Splash Color",self.splash_color,1)
        ttk.Checkbutton(appearance,text="Force WebView dark mode",variable=self.dark_mode).grid(row=2,column=1,sticky="w",pady=8)
        ttk.Label(appearance,text="Launcher Icon (PNG, optional)").grid(row=3,column=0,sticky="w",pady=(18,4))
        ttk.Entry(appearance,textvariable=self.icon_path).grid(row=3,column=1,sticky="ew",padx=12)
        ttk.Button(appearance,text="Browse",command=self.pick_icon).grid(row=3,column=2)
        ttk.Label(appearance,text="PNG akan dipasang ke generated Android app. Jika kosong, icon bawaan template digunakan.",wraplength=650).grid(row=4,column=1,columnspan=2,sticky="w",pady=(8,0))
        appearance.grid_columnconfigure(1,weight=1)
        for label,var in [("JavaScript",self.javascript),("File Upload",self.file_upload),("Pull to Refresh",self.pull_refresh),("External Links / Custom Schemes",self.external_links)]:
            ttk.Checkbutton(features,text=label,variable=var).pack(anchor="w",pady=9)
        ttk.Label(features,text="Pengaturan ini dikompilasi ke aplikasi Android yang dihasilkan.").pack(anchor="w",pady=(14,0))
        ttk.Label(build,text="Build Console",font=("Segoe UI",12,"bold")).pack(anchor="w")
        self.log=tk.Text(build,height=24,wrap="word",state="disabled"); self.log.pack(fill="both",expand=True,pady=(8,12))
        buttons=ttk.Frame(build); buttons.pack(fill="x")
        self.generate_button=ttk.Button(buttons,text="Generate Project",command=self.generate_async); self.generate_button.pack(side="left")
        self.debug_button=ttk.Button(buttons,text="Build Debug APK",command=lambda:self.build_async("debug")); self.debug_button.pack(side="left",padx=7)
        self.release_button=ttk.Button(buttons,text="Build Release APK",command=lambda:self.build_async("release")); self.release_button.pack(side="left")
        self.aab_button=ttk.Button(buttons,text="Build Release AAB",command=lambda:self.build_async("bundle")); self.aab_button.pack(side="left",padx=7)
        self.export_button=ttk.Button(buttons,text="Export Project ZIP",command=self.export_zip); self.export_button.pack(side="left")
        ttk.Button(buttons,text="Open Output",command=self.open_output).pack(side="right")
        bottom=ttk.Frame(self); bottom.pack(fill="x",pady=(12,0))
        ttk.Button(bottom,text="Save Config",command=self.save_config).pack(side="right")
        ttk.Button(bottom,text="Load Config",command=self.load_config).pack(side="right",padx=8)

    def _field(self,parent,label,var,row):
        parent.grid_columnconfigure(1,weight=1)
        ttk.Label(parent,text=label).grid(row=row,column=0,sticky="w",pady=(0,10))
        ttk.Entry(parent,textvariable=var).grid(row=row,column=1,sticky="ew",pady=(0,10),padx=(16,0))

    def pick_icon(self):
        path=filedialog.askopenfilename(title="Select Launcher Icon",filetypes=[("PNG images","*.png")])
        if path:self.icon_path.set(path)
    def pick_output(self):
        path=filedialog.askdirectory(title="Select Output Folder")
        if path:self.output_dir.set(path)

    def config(self):
        return {"app_name":self.app_name.get().strip(),"package_name":self.package_name.get().strip(),"website_url":self.website_url.get().strip(),
                "version_name":self.version_name.get().strip(),"version_code":int(self.version_code.get()),
                "theme":{"primary_color":self.primary_color.get().strip(),"splash_color":self.splash_color.get().strip(),"dark_mode":self.dark_mode.get()},
                "features":{"javascript":self.javascript.get(),"file_upload":self.file_upload.get(),"pull_to_refresh":self.pull_refresh.get(),"external_links":self.external_links.get()},
                "icon_path":self.icon_path.get().strip()}

    def validate(self):
        c=self.config()
        if not c["app_name"]: raise ValueError("App Name wajib diisi.")
        if not re.match(r"^https?://",c["website_url"],re.I): raise ValueError("Website URL harus diawali http:// atau https://.")
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$",c["package_name"]): raise ValueError("Package Name Android tidak valid.")
        for key in ("primary_color","splash_color"):
            if not re.match(r"^#[0-9a-fA-F]{6}$",c["theme"][key]): raise ValueError(f"{key} harus format #RRGGBB.")
        if c["version_code"]<1: raise ValueError("Version Code harus >= 1.")
        if c["icon_path"] and not Path(c["icon_path"]).is_file(): raise ValueError("File icon tidak ditemukan.")
        return c

    def save_config(self):
        try:
            c=self.validate(); path=filedialog.asksaveasfilename(defaultextension=".json",filetypes=[("JSON","*.json")])
            if path: Path(path).write_text(json.dumps(c,indent=2),encoding="utf-8"); self.write_log(f"Config saved: {path}")
        except Exception as exc: messagebox.showerror("Validation error",str(exc))

    def load_config(self):
        path=filedialog.askopenfilename(filetypes=[("JSON","*.json")])
        if not path:return
        try:
            c=json.loads(Path(path).read_text(encoding="utf-8")); self.app_name.set(c.get("app_name","")); self.package_name.set(c.get("package_name",""))
            self.website_url.set(c.get("website_url","")); self.version_name.set(c.get("version_name","1.0.0")); self.version_code.set(str(c.get("version_code",1)))
            t=c.get("theme",{}); self.primary_color.set(t.get("primary_color","#111827")); self.splash_color.set(t.get("splash_color","#111827")); self.dark_mode.set(bool(t.get("dark_mode",False)))
            f=c.get("features",{}); self.javascript.set(bool(f.get("javascript",True))); self.file_upload.set(bool(f.get("file_upload",True))); self.pull_refresh.set(bool(f.get("pull_to_refresh",True))); self.external_links.set(bool(f.get("external_links",True))); self.icon_path.set(c.get("icon_path",""))
            self.write_log(f"Config loaded: {path}")
        except Exception as exc: messagebox.showerror("Load error",str(exc))

    def write_log(self,msg):
        self.log.configure(state="normal"); self.log.insert("end",msg+"\n"); self.log.see("end"); self.log.configure(state="disabled")
    def _post(self,kind,msg): self.events.put((kind,msg))
    def _drain_events(self):
        try:
            while True:
                kind,msg=self.events.get_nowait()
                if kind=="log": self.write_log(msg)
                elif kind=="busy": self._set_busy(msg=="1")
                elif kind=="info": messagebox.showinfo("WebVIEW Generator",msg)
                elif kind=="error": messagebox.showerror("WebVIEW Generator",msg)
        except queue.Empty: pass
        self.after(100,self._drain_events)
    def _set_busy(self,value):
        self.busy=value; state="disabled" if value else "normal"
        for b in (self.generate_button,self.debug_button,self.release_button,self.aab_button,self.export_button): b.configure(state=state)

    def _make_config_file(self,c):
        temp=Path(self.output_dir.get()).expanduser().resolve()/".webview-active-config.json"; temp.parent.mkdir(parents=True,exist_ok=True)
        temp.write_text(json.dumps(c,indent=2),encoding="utf-8"); return temp
    def _project_path(self,c):
        slug=re.sub(r"[^a-zA-Z0-9]+","-",c["app_name"]).strip("-").lower() or "webview-app"
        return Path(self.output_dir.get()).expanduser().resolve()/slug

    def _generate(self):
        c=self.validate(); output=self._project_path(c); config_path=self._make_config_file(c)
        cmd=[sys.executable,str(GENERATOR),"--config",str(config_path),"--output",str(output)]
        self._post("log","$ "+" ".join(cmd))
        p=subprocess.Popen(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
        for line in p.stdout or []: self._post("log",line.rstrip())
        code=p.wait(); config_path.unlink(missing_ok=True)
        if code!=0: raise RuntimeError("Generator gagal. Lihat Build Console untuk detail.")
        self.last_project=output; self._post("log",f"PROJECT READY: {output}"); return output

    def _java17_home(self):
        candidates=[]
        java_home=os.environ.get("JAVA_HOME","").strip()
        if java_home:
            candidates.append(Path(java_home))
        if os.name=="nt":
            candidates.extend([
                Path("C:/jdk-17.0.12"),
                Path("C:/Program Files/Java/jdk-17"),
                Path("C:/Program Files/Android/Android Studio/jbr"),
                Path("C:/Program Files/Android/Android Studio/jdk"),
            ])
            for root_name in ("ProgramFiles","ProgramFiles(x86)","LOCALAPPDATA"):
                root=os.environ.get(root_name)
                if root:
                    candidates.append(Path(root)/"Java")
        seen=set()
        for home in candidates:
            key=str(home).lower()
            if key in seen or not home.is_dir():
                continue
            seen.add(key)
            java=home/"bin"/("java.exe" if os.name=="nt" else "java")
            if not java.exists():
                continue
            try:
                result=subprocess.run([str(java),"-version"],text=True,capture_output=True,timeout=15)
                output=(result.stdout or "")+"\\n"+(result.stderr or "")
                if re.search(r'version "17(?:[.\\-]|$)',output):
                    return str(home)
            except Exception:
                pass
        return None

    def _process_env(self):
        env=os.environ.copy()
        jdk17=self._java17_home()
        if jdk17:
            env["JAVA_HOME"]=jdk17
            env["PATH"]=str(Path(jdk17)/"bin")+os.pathsep+env.get("PATH","")
            self._post("log",f"JDK 17 digunakan untuk Android build: {jdk17}")
        else:
            self._post("log","JDK 17 tidak ditemukan; build akan menggunakan JAVA_HOME/PATH yang tersedia.")
        return env

    def _gradle_version(self,executable):
        try:
            result=subprocess.run([executable,"--version"],text=True,capture_output=True,timeout=30,env=self._process_env())
            output=(result.stdout or "")+"\\n"+(result.stderr or "")
            match=re.search(r"Gradle\\s+(\\d+\\.\\d+(?:\\.\\d+)?)",output,re.I)
            return match.group(1) if match else None
        except Exception:
            return None

    def _gradle_candidates(self):
        candidates=[]
        gradle_home=os.environ.get("GRADLE_HOME","").strip()
        if gradle_home:
            candidates.append(Path(gradle_home)/"bin"/("gradle.bat" if os.name=="nt" else "gradle"))

        for name in ("gradle","gradle.bat"):
            found=shutil.which(name)
            if found:
                candidates.append(Path(found))

        if os.name=="nt":
            roots=[]
            for env_name in ("USERPROFILE","LOCALAPPDATA","ProgramFiles","ProgramFiles(x86)"):
                value=os.environ.get(env_name)
                if value:
                    roots.append(Path(value))
            roots.extend([Path("C:/Gradle"),Path("C:/gradle"),Path("C:/")])
            candidates.extend([Path("C:/gradle-8.13/bin/gradle.bat"),Path("C:/gradle-8.13/bin/gradle")])

            for root in roots:
                if not root.exists():
                    continue
                try:
                    for item in root.glob("gradle-*"):
                        candidates.append(item/"bin"/"gradle.bat")
                except OSError:
                    pass

        seen=set()
        for candidate in candidates:
            key=str(candidate).lower()
            if key not in seen:
                seen.add(key)
                yield candidate

    def _find_compatible_gradle(self):
        required=GRADLE_VERSION
        incompatible=[]
        self._post("log","Checking local Gradle installations...")
        for candidate in self._gradle_candidates():
            if not candidate.is_file():
                continue
            self._post("log",f"Checking Gradle: {candidate}")
            version=self._gradle_version(str(candidate))
            if version==required:
                return str(candidate)
            if version:
                incompatible.append((str(candidate),version))

        if incompatible:
            for path,version in incompatible:
                self._post("log",f"Gradle ditemukan tetapi tidak kompatibel: {path} ({version}). Project membutuhkan Gradle {required}.")
        return None

    def _gradle_command(self,project):
        wrapper=project/("gradlew.bat" if os.name=="nt" else "gradlew")
        if wrapper.exists():
            if os.name!="nt": wrapper.chmod(wrapper.stat().st_mode|0o111)
            return [str(wrapper)]

        gradle=self._find_compatible_gradle()
        if gradle:
            self._post("log",f"Gradle kompatibel ditemukan: {gradle} (Gradle {GRADLE_VERSION})")
        else:
            self._post("log",f"Gradle {GRADLE_VERSION} tidak ditemukan. Menggunakan Gradle {GRADLE_VERSION} otomatis.")
            gradle=self._bootstrap_gradle()
            self._post("log",f"Gradle bootstrap: {gradle}")

        result=subprocess.run(
            [gradle,"wrapper",f"--gradle-version={GRADLE_VERSION}","--distribution-type=bin"],
            cwd=project,text=True,capture_output=True,env=self._process_env()
        )
        if result.stdout: self._post("log",result.stdout.rstrip())
        if result.stderr: self._post("log",result.stderr.rstrip())
        if result.returncode!=0:
            details=(result.stderr or result.stdout or "").strip()
            raise RuntimeError(
                "Gagal membuat Gradle wrapper. "
                f"Gradle yang digunakan: {gradle}. "
                "Pastikan JDK 17+ tersedia dan project dapat dijalankan oleh Gradle."
                + (f"\\nDetail Gradle: {details[-2000:]}" if details else "")
            )
        if not wrapper.exists():
            raise RuntimeError("Gradle wrapper tidak terbentuk setelah perintah Gradle selesai.")
        if os.name!="nt": wrapper.chmod(wrapper.stat().st_mode|0o111)
        return [str(wrapper)]

    def _bootstrap_gradle(self):
        cache_root=Path(os.environ.get("LOCALAPPDATA",str(Path.home()))) / "WebVIEW-Generator" / "gradle"
        install_dir=cache_root/f"gradle-{GRADLE_VERSION}"
        if os.name=="nt":
            local_executable=Path(f"C:/gradle-{GRADLE_VERSION}/bin/gradle.bat")
            if local_executable.exists() and self._gradle_version(str(local_executable))==GRADLE_VERSION:
                self._post("log",f"Using local Gradle {GRADLE_VERSION}: {local_executable}")
                return str(local_executable)
        executable=install_dir/"bin"/("gradle.bat" if os.name=="nt" else "gradle")
        if executable.exists():
            version=self._gradle_version(str(executable))
            if version==GRADLE_VERSION:
                return str(executable)
            self._post("log",f"Cache Gradle tidak sesuai versi ({version or 'unknown'}), menyiapkan Gradle {GRADLE_VERSION} ulang.")

        cache_root.mkdir(parents=True,exist_ok=True)
        archive=cache_root/f"gradle-{GRADLE_VERSION}-bin.zip"
        self._post("log",f"Gradle tidak ditemukan. Mengunduh Gradle {GRADLE_VERSION}...")
        try:
            urllib.request.urlretrieve(GRADLE_URL,archive)
            self._post("log",f"Gradle download selesai: {archive}")
            with ZipFile(archive,"r") as z:
                z.extractall(cache_root)
            archive.unlink(missing_ok=True)
        except Exception as exc:
            archive.unlink(missing_ok=True)
            raise RuntimeError(f"Tidak dapat menyiapkan Gradle {GRADLE_VERSION}: {exc}")
        if not executable.exists():
            raise RuntimeError(f"Gradle {GRADLE_VERSION} berhasil diunduh tetapi executable tidak ditemukan.")
        return str(executable)

    def _build(self,kind):
        project=self._generate(); task={"debug":"assembleDebug","release":"assembleRelease","bundle":"bundleRelease"}[kind]
        self._post("log",f"BUILD START: {task}")
        p=subprocess.Popen(self._gradle_command(project)+[task,"--no-daemon","--stacktrace"],cwd=project,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,env=self._process_env())
        for line in p.stdout or []: self._post("log",line.rstrip())
        code=p.wait()
        if code!=0: raise RuntimeError(f"Gradle build gagal (exit code {code}).")
        artifact = (project/"app"/"build"/"outputs"/"bundle"/"release") if kind=="bundle" else (project/"app"/"build"/"outputs"/"apk"/("release" if kind=="release" else "debug"))
        self._post("log",f"BUILD SUCCESS: {task}"); self._post("log",f"ARTIFACT: {artifact}"); return artifact

    def _run_async(self,fn,success):
        if self.busy:return
        self._set_busy(True)
        def worker():
            try:self._post("info",f"{success}\n{fn()}")
            except Exception as exc:self._post("log","ERROR: "+str(exc)); self._post("error",str(exc))
            finally:self._post("busy","0")
        threading.Thread(target=worker,daemon=True).start()
    def generate_async(self): self._run_async(self._generate,"Project berhasil dibuat.")
    def build_async(self,kind): self._run_async(lambda:self._build(kind),f"Build {kind} berhasil.")

    def export_zip(self):
        project=self.last_project
        if not project or not project.exists(): messagebox.showwarning("Export","Generate project terlebih dahulu."); return
        target=filedialog.asksaveasfilename(title="Export Android Project",initialfile=f"{project.name}-android-project.zip",defaultextension=".zip",filetypes=[("ZIP archive","*.zip")])
        if not target:return
        with ZipFile(target,"w",ZIP_DEFLATED) as z:
            for p in project.rglob("*"):
                if p.is_file() and ".gradle" not in p.parts and "build" not in p.parts: z.write(p,p.relative_to(project.parent))
        self.write_log(f"PROJECT ZIP: {target}"); messagebox.showinfo("Export",f"Project ZIP berhasil dibuat:\n{target}")

    def open_output(self):
        path=self.last_project or Path(self.output_dir.get()).expanduser().resolve(); path.mkdir(parents=True,exist_ok=True)
        if os.name=="nt": os.startfile(path)
        elif sys.platform=="darwin": subprocess.Popen(["open",str(path)])
        else: subprocess.Popen(["xdg-open",str(path)])

if __name__=="__main__": GeneratorApp().mainloop()
