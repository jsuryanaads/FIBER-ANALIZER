import fs from "node:fs";
import path from "node:path";

const root=path.resolve(".");
const appDir=path.join(root,"app");
const appHtml=fs.readdirSync(appDir).filter(x=>x.endsWith(".html"));
if(appHtml.length!==1||appHtml[0]!=="index.html")throw new Error("Page source duplication detected: "+appHtml.join(", "));

const index=fs.readFileSync(path.join(appDir,"index.html"),"utf8");
const app=fs.readFileSync(path.join(appDir,"app.js"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/deploy-pages.yml"),"utf8");
const builder=fs.readFileSync(path.join(root,"scripts/build-pages.mjs"),"utf8");
const readme=fs.readFileSync(path.join(root,"README.md"),"utf8");
const supabaseConfig=fs.readFileSync(path.join(root,"supabase/config.toml"),"utf8");
if(!fs.existsSync(path.join(root,"supabase/functions/admin-user/index.ts")))throw new Error("admin-user source missing");
if(!fs.existsSync(path.join(root,"supabase/functions/bootstrap-admin/index.ts")))throw new Error("bootstrap-admin source missing");
if(!supabaseConfig.includes('project_id = "xdfwtsixuwikijknkvlz"'))throw new Error("Supabase project config missing");

if(!index.includes('<base href="/FIBER-ANALIZER/">'))throw new Error("GitHub Pages base path missing");
if(!index.includes('src="./app.js?v='))throw new Error("app.js cache-busting version missing");
if(!index.includes('data-page="dashboard"'))throw new Error("Canonical dashboard page marker missing");
if(!app.includes('const APP_BASE="/FIBER-ANALIZER"'))throw new Error("Application base path missing");
if(!workflow.includes("branches:\n      - main"))throw new Error("Pages deployment must be main-only");
if(workflow.includes("feature/fiber-network-foundation"))throw new Error("Feature branch must not deploy to production Pages");
if(!workflow.includes("node scripts/build-pages.mjs"))throw new Error("Page build step missing");
if(!builder.includes("dashboard.html")||!builder.includes("settings.html"))throw new Error("Page manifest incomplete");
if(!readme.includes("OLT → OLT Port → OTB → JB → BOX ODC-ODP → BOX ODC → BOX ODP → Customer"))throw new Error("README topology is stale");
if(readme.includes("OLT → PON → JB → ODC → ODP → Customer"))throw new Error("Legacy README topology leaked");
console.log("project structure integrity test passed");