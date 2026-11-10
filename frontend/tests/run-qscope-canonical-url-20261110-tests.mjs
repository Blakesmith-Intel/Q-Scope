import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const read=path=>readFileSync(join(root,path),"utf8");
const pages=read(".github/workflows/pages.yml");
const html=read("frontend/live3d-operational-v9.html");
const guide=read("docs/OPERATOR_GUIDE_CURRENT.md");
const readme=read("README.md");
const brand=read("docs/Q_SCOPE_BRAND_IDENTITY.md");
const newPage="https://blakesmith-intel.github.io/Q-Scope/";
const newGuide="https://github.com/Blakesmith-Intel/Q-Scope/blob/main/docs/OPERATOR_GUIDE_CURRENT.md";
const oldPage="https://blakesmith-intel.github.io/StormTracker";
const oldGuide="https://github.com/Blakesmith-Intel/StormTracker/blob/main/docs/OPERATOR_GUIDE_CURRENT.md";

for(const [name,text] of [["deployment",pages],["operator HTML",html],["guide",guide],["README",readme],["identity",brand]]){
  assert(!text.includes(oldPage),name+" retains former Pages project path");
  assert(!text.includes(oldGuide),name+" retains old current-guide repository URL");
}
assert(pages.includes('base="https://blakesmith-intel.github.io/Q-Scope"'),
  "Pages source checks must point at live canonical project URL");
assert((pages.match(/base="https:\/\/blakesmith-intel.github.io\/Q-Scope"/g)||[]).length>=9,
  "All production URL smoke checks must use renamed Pages path");
assert(html.includes('href="'+newGuide+'"'),"Operator guide must use current repository");
assert(guide.includes(newPage),"Operator guide must open real Pages URL");
assert(readme.includes(newPage),"README must identify real Pages URL");
assert(brand.includes(newPage),"Identity contract must identify canonical URL");
assert(brand.includes("1466851327584b62e06172b3aa2c279afd27870e"),
  "Brand routing must reference immutable source without rewriting it");
console.log("PASS renamed /Q-Scope/ canonical Pages route and Q-Scope repository guide link");
