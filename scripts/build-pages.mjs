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

function keepOnlyPageSections(html,page){
  const target="page-"+({
    dashboard:"dashboard",
    topology:"topology",
    inventory:"inventory",
    "cable-core":"cable",
    "trace-analysis":"trace",
    "optical-analyzer":"optical",
    incident:"incident",
    "work-order":"workorder",
    customer:"customer",
    reports:"reports",
    users:"users",
    settings:"settings"
  }[page]||"dashboard")+"-section";
  const tagRe=/<\/?section\b[^>]*>/gi;
  const stack=[];
  const roots=[];
  let match;
  while((match=tagRe.exec(html))){
    const tag=match[0];
    const isClose=/^<\//.test(tag);
    if(!isClose){
      const node={start:match.index,end:0,keep:false,parent:stack.at(-1)||null};
      node.keep=new RegExp("\\b"+target+"\\b").test(tag);
      if(stack.length===0)roots.push(node);
      stack.push(node);
    }else{
      const node=stack.pop();
      if(!node)throw new Error("Unbalanced section markup");
      node.end=tagRe.lastIndex;
      if(node.parent&&node.keep)node.parent.keep=true;
    }
  }
  if(stack.length)throw new Error("Unbalanced section markup");
  const removals=roots.filter(x=>!x.keep).map(x=>[x.start,x.end]);
  let out=html;
  for(let i=removals.length-1;i>=0;i--)out=out.slice(0,removals[i][0])+out.slice(removals[i][1]);
  return out;
}

if(process.argv.includes("--check")){
  if(!source.includes("<body"))throw new Error("Canonical page template is invalid");
  for(const page of Object.values(pages)){
    const built=keepOnlyPageSections(source,page);
    if(!built.includes('data-page="'+page+'"'))throw new Error("Missing page marker: "+page);
    if(!built.includes("page-"+({dashboard:"dashboard",topology:"topology",inventory:"inventory","cable-core":"cable","trace-analysis":"trace","optical-analyzer":"optical",incident:"incident","work-order":"workorder",customer:"customer",reports:"reports",users:"users",settings:"settings"}[page])+"-section")){
      throw new Error("Missing page section: "+page);
    }
  }
  console.log("page template check passed");
  process.exit(0);
}

const out=path.resolve("_site");
fs.mkdirSync(out,{recursive:true});
for(const [file,page] of Object.entries(pages)){
  const html=keepOnlyPageSections(source,page).replace(/<body(?:\s+data-page="[^"]*")?>/,`<body data-page="${page}">`);
  fs.writeFileSync(path.join(out,file),html);
}
fs.copyFileSync(path.resolve("app/index.html"),path.join(out,"index.html"));
console.log(`Generated ${Object.keys(pages).length} focused application pages from app/index.html`);