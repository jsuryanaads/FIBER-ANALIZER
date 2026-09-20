import fs from "node:fs";
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const ids=[...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m=>m[1]);
const dynamicAuthIds=new Set(["setupForm","setupUser","setupName","setupPass","setupPass2","loginForm","loginUser","loginPass","registerForm","registerEmail","registerName","registerUsername","registerOrg","registerPass","registerPass2","loginEmail","loginPass","userEmail","backLogin","registerLink"]);
const missing=[...new Set(ids)].filter(id=>!dynamicAuthIds.has(id)&&!new RegExp(`(?:id|name)=["\x27]${id}["\x27]`).test(html));
if(missing.length)throw new Error("UI IDs missing from index.html: "+missing.join(", "));
if(!html.includes('src="./app.js"'))throw new Error("app.js is not loaded");
if(!html.includes('<base href="/FIBER-ANALIZER/">'))throw new Error("GitHub Pages base path missing");
if(!js.includes('const APP_BASE="/FIBER-ANALIZER"'))throw new Error("GitHub Pages route base missing");
if(!html.includes('id="connectionList"'))throw new Error("Core connection UI missing");
if(!html.includes('id="oltPorts"'))throw new Error("OLT port inventory UI missing");
if(!js.includes("function renderOltPorts()"))throw new Error("OLT port renderer missing");
if(!js.includes("fromPort")||!js.includes("toPort"))throw new Error("Cable port mapping missing");
if(!js.includes("olt_ports"))throw new Error("OLT port metadata missing");

const topologyMatch=js.match(/const topology=\[(.*?)\];/s)?.[1]||"";
if(/"PON"|"OLT_PON"|"OBT"/.test(topologyMatch))throw new Error("Legacy PON/OBT type leaked into active topology");

const assetTypeOptions=html.match(/<select id="assetType">([\s\S]*?)<\/select>/)?.[1]||"";
if(/value="PON"|value="OLT_PON"|>PON<|>OBT</.test(assetTypeOptions))throw new Error("Legacy PON/OBT option still exposed in asset selector");

if(!js.includes('"OLT"')&&!js.includes("OLT"))throw new Error("OLT asset type missing");
if(/type:"PON"|type:"OLT_PON"|type:"OBT"/.test(js.match(/const seed=\{[\s\S]*?\};/)?.[0]||""))throw new Error("Legacy PON/OBT asset remains in demo seed");

console.log("UI integrity test passed");
if(!html.includes("Manajemen User"))throw new Error("User management UI missing");
if(!html.includes("id=\"userForm\""))throw new Error("User management form missing");
if(!js.includes("ROLE_PERMISSIONS")||!js.includes("user.manage"))throw new Error("RBAC permissions missing");
if(!js.includes("supabase.auth.signInWithPassword"))throw new Error("Supabase login missing");
if(!js.includes("network_assets")||!js.includes("network_cables")||!js.includes("network_cores"))throw new Error("Supabase network CRUD tables missing");
if(!js.includes("syncNetworkState")||!js.includes("readNetworkState"))throw new Error("Supabase network persistence missing");
if(!js.includes("loadOperationalData")||!js.includes("syncOperationalData")||!js.includes("incidents")||!js.includes("work_orders"))throw new Error("Operational Supabase persistence missing");
if(!js.includes("supabase.auth.signUp"))throw new Error("Administrator registration missing");
if(!js.includes('supabase.functions.invoke("admin-user"'))throw new Error("Admin user invitation missing");
if(!js.includes('"/admin/login"')||!js.includes('"/pengelola/login"')||!js.includes('"/teknisi/login"'))throw new Error("Role portal routes missing");
if(!js.includes("persistSession:true")||!js.includes("storageKey:\"fiber-analyzer-auth\""))throw new Error("Supabase session persistence missing");
if(!js.includes('const isAdmin=currentProfile.role==="ADMINISTRATOR"'))throw new Error("Administrator visibility guard missing");
if(!js.includes("el.style.display=isAdmin"))throw new Error("Administrator section display logic missing");

console.log("RBAC UI integrity test passed");


const pageFiles=["index.html","topology.html","inventory.html","cable-core.html","trace-analysis.html","optical-analyzer.html","incident.html","work-order.html","customer.html","reports.html","users.html","settings.html"];
for(const file of pageFiles){
  const pageHtml=fs.readFileSync(new URL("../app/"+file,import.meta.url),"utf8");
  if(!pageHtml.includes('src="./app.js"'))throw new Error("app.js missing from "+file);
  if(!pageHtml.match(/<body[^>]*data-page="[^"]+"/))throw new Error("data-page missing from "+file);
  if(!pageHtml.includes('<base href="/FIBER-ANALIZER/">'))throw new Error("base path missing from "+file);
}
if(!js.includes("remoteReadOk"))throw new Error("Supabase read-failure guard missing");
if(!js.includes("Data organisasi tidak dapat dibaca dari Supabase"))throw new Error("Remote/local data safety guard missing");

if(!html.includes('id="incidentDialog"')||!html.includes('id="workOrderDialog"')||!html.includes('id="customerDialog"'))throw new Error("Operational dialogs missing");
if(!js.includes("function ensureOperationalUI()")||!js.includes("ensureOperationalUI();"))throw new Error("Shared operational UI bootstrap missing");
if(!js.includes('page==="incident"&&!$(\"addIncident\")'))throw new Error("Incident page operational UI bootstrap missing");
if(!js.includes("function renderIncidents()")||!js.includes('supabase.from("incidents").insert')||!js.includes('supabase.from("work_orders").insert'))throw new Error("Operational CRUD handlers missing");
if(!js.includes('requirePermission("customer.write")'))throw new Error("Customer RBAC guard missing");
