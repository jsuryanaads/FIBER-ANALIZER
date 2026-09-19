import fs from "node:fs";
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const ids=[...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m=>m[1]);
const missing=[...new Set(ids)].filter(id=>!new RegExp(`(?:id|name)=["']${id}["']`).test(html));
if(missing.length)throw new Error("UI IDs missing from index.html: "+missing.join(", "));
if(!html.includes('src="./app.js"'))throw new Error("app.js is not loaded");
if(!html.includes('id="connectionList"'))throw new Error("Core connection UI missing");
if(!html.includes('id="oltPorts"'))throw new Error("OLT port inventory UI missing");
if(!js.includes("function renderOltPorts()"))throw new Error("OLT port renderer missing");
if(!js.includes("fromPort")||!js.includes("toPort"))throw new Error("Cable port mapping missing");
if(!js.includes("olt_ports"))throw new Error("OLT port metadata missing");

const topologyMatch=js.match(/const topology=\[(.*?)\];/s)?.[1]||"";
if(/"PON"|"OLT_PON"|"OBT"/.test(topologyMatch))throw new Error("Legacy PON/OBT type leaked into active topology");

const assetTypeOptions=html.match(/<select id="assetType">([\s\S]*?)<\/select>/)?.[1]||"";
if(/value="PON"|value="OLT_PON"|>PON<|>OBT</.test(assetTypeOptions))throw new Error("Legacy PON/OBT option still exposed in asset selector");

if(!/type:"OLT"/.test(js))throw new Error("OLT asset type missing");
if(/type:"PON"|type:"OLT_PON"|type:"OBT"/.test(js.match(/const seed=\{[\s\S]*?\};/)?.[0]||""))throw new Error("Legacy PON/OBT asset remains in demo seed");

console.log("UI integrity test passed");
if(!html.includes("Manajemen User"))throw new Error("User management UI missing");
if(!html.includes("id=\"userForm\""))throw new Error("User management form missing");
if(!js.includes("ROLE_PERMISSIONS")||!js.includes("user.manage"))throw new Error("RBAC permissions missing");
console.log("RBAC UI integrity test passed");
