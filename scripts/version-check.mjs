import fs from "node:fs";

const pkg=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const version=String(pkg.version||"");
if(!/^\d+\.\d+\.\d+$/.test(version)){
  throw new Error("package.json version must use MAJOR.MINOR.PATCH");
}
console.log("application version valid:",version);
