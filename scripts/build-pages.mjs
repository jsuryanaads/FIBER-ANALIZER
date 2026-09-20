import fs from "node:fs";
import path from "node:path";

const source=fs.readFileSync(path.resolve("app/index.html"),"utf8");
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

if(process.argv.includes("--check")){if(!source.includes("<body"))throw new Error("Canonical page template is invalid");console.log("page template check passed");process.exit(0);}

const out=path.resolve("_site");
fs.mkdirSync(out,{recursive:true});
for(const [file,page] of Object.entries(pages)){
  const html=source.replace(/<body(?:\s+data-page="[^"]*")?>/,`<body data-page="${page}">`);
  fs.writeFileSync(path.join(out,file),html);
}
fs.copyFileSync(path.resolve("app/index.html"),path.join(out,"index.html"));
console.log(`Generated ${Object.keys(pages).length} application pages from app/index.html`);