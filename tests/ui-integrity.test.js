import fs from "node:fs";
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const ids=[...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m=>m[1]);
const missing=[...new Set(ids)].filter(id=>!new RegExp(`(?:id|name)=["']${id}["']`).test(html));
if(missing.length)throw new Error("UI IDs missing from index.html: "+missing.join(", "));
if(!html.includes('src="./app.js"'))throw new Error("app.js is not loaded");
if(!html.includes('id="connectionList"'))throw new Error("Core connection UI missing");

const topologyMatch=js.match(/const topology=\[(.*?)\];/s)?.[1]||"";
if(/"PON"|"OLT_PON"|"OBT"/.test(topologyMatch))throw new Error("Legacy PON/OBT type leaked into active topology");

const assetTypeOptions=html.match(/<select id="assetType">([\s\S]*?)<\/select>/)?.[1]||"";
if(/value="PON"|value="OLT_PON"|>PON<|>OBT</.test(assetTypeOptions))throw new Error("Legacy PON/OBT option still exposed in asset selector");

if(!/type:"OLT"/.test(js))throw new Error("OLT asset type missing");
if(/type:"PON"|type:"OLT_PON"|type:"OBT"/.test(js.match(/const seed=\{[\s\S]*?\};/)?.[0]||""))throw new Error("Legacy PON/OBT asset remains in demo seed");

console.log("UI integrity test passed");