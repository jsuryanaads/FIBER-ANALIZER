import fs from "node:fs";
import path from "node:path";

const source=fs.readFileSync(path.resolve("app/index.html"),"utf8");
const packageJson=JSON.parse(fs.readFileSync(path.resolve("package.json"),"utf8"));
const appVersion=String(packageJson.version||"0.0.0");
const pages={
  "dashboard.html":"dashboard",
  "topology.html":"topology",
  "inventory.html":"inventory",
  "cable-core.html":"cable-core",
  "trace-analysis.html":"trace-analysis",
  "optical-analyzer.html":"optical-analyzer",
  "incident.html":"incident",
  "work-order.html":"work-order",
  "customer.html":"customer",
  "reports.html":"reports",
  "users.html":"users",
  "settings.html":"settings"
};

if(process.argv.includes("--check")){
  if(!source.includes("<body"))throw new Error("Canonical page template is invalid");
  if(!packageJson.version)throw new Error("Application version missing from package.json");
  if(!source.includes("__APP_VERSION__"))throw new Error("Application version placeholder missing");
  for(const [file,page] of Object.entries(pages)){
    const cls="page-"+({dashboard:"dashboard",topology:"topology",inventory:"inventory","cable-core":"cable","trace-analysis":"trace","optical-analyzer":"optical",incident:"incident","work-order":"workorder",customer:"customer",reports:"reports",users:"users",settings:"settings"}[page])+"-section";
    if(!source.includes(cls))throw new Error("Missing page section: "+file);
  }
  console.log("page template check passed");
  process.exit(0);
}

const out=path.resolve("_site");
fs.mkdirSync(out,{recursive:true});
for(const [file,page] of Object.entries(pages)){
  const html=source.replace(/<body(?:\s+data-page="[^"]*")?>/,`<body data-page="${page}">`).replaceAll("__APP_VERSION__",appVersion);
  fs.writeFileSync(path.join(out,file),html);
}
fs.writeFileSync(path.join(out,"index.html"),source.replaceAll("__APP_VERSION__",appVersion));
console.log(`Generated ${Object.keys(pages).length} application pages from app/index.html`);