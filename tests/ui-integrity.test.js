import fs from "node:fs";
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const ids=[...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m=>m[1]);
const missing=[...new Set(ids)].filter(id=>!new RegExp(`(?:id|name)=["']${id}["']`).test(html));
if(missing.length)throw new Error("UI IDs missing from index.html: "+missing.join(", "));
if(!html.includes('src="./app.js"'))throw new Error("app.js is not loaded");
if(!html.includes('id="connectionList"'))throw new Error("Core connection UI missing");
console.log("UI integrity test passed");
