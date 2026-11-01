import assert from "node:assert/strict";
import {webkit} from "playwright";
// Test actual BoM source, real image decoding and frame verification in a
// mobile WebKit engine (closer to iPhone Safari than desktop Chromium).
const browser=await webkit.launch({headless:true});
const page=await browser.newPage({
  viewport:{width:390,height:780},
  deviceScaleFactor:2,isMobile:true,hasTouch:true
});
page.setDefaultTimeout(420000);
const faults=[];
// Keep the public production Origin while serving our proposed package from
// local QA files: the real BoM CORS relay authorises the production site,
// not an arbitrary localhost origin.
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
  const url=new URL(route.request().url());
  const local="http://127.0.0.1:8137"+url.pathname.replace("/StormTracker","")+url.search;
  try{
    const response=await fetch(local);
    await route.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),
      contentType:response.headers.get("content-type")||"application/octet-stream"});
  }catch(e){await route.abort("failed");}
});
page.on("pageerror",e=>faults.push(String(e)));
page.on("console",m=>{if(/HTTP 4|HTTP 5|incomplete BoM/i.test(m.text()))faults.push(m.text().slice(0,250));});
try{
  await page.goto("https://blakesmith-intel.github.io/StormTracker/ftp-aep-smoke.html",{waitUntil:"domcontentloaded"});
  const result=await page.evaluate(async()=>{
    const radar=await import("./src/bom-wmts-loop-v2.js?v=20261101-source-verified-recovery-v10-2-40");
    const {isVerifiedHiResRadarFrame}=await import("./src/hires-radar-loop-policy-v1.js");
    const {networkPressureDiagnostics}=await import("./src/radar-source.js?v=20261101-source-png-blob-reuse");
    const logs=[];
    for(const region of ["66","106","24","107","74","75","36"]){
      const now=Date.now();
      const times=await radar.discoverBomReflectivityHistory(now,180,region);
      const expected=times.slice(-6);
      const actual=[];
      for(const time of expected){
        const frame=await radar.loadBomReflectivityMosaicAtTime(time,region,times);
        if(!isVerifiedHiResRadarFrame(frame))throw Error("Unverified WebKit tile at "+region+" "+time);
        if(frame.sourceMetadata?.region!==region)throw Error("Cross-site WebKit cache contamination at "+region);
        actual.push(frame.observedUtc);
      }
      if(actual.length!==6)throw Error("WebKit radar "+region+" has "+actual.length+"/6 native frames");
      logs.push({region,earliest:actual[0],latest:actual.at(-1),
        count:actual.length,pressure:networkPressureDiagnostics()});
    }
    return logs;
  });
  for(const site of result)assert.equal(site.count,6);
  console.log("LIVE_WEBKIT_MOBILE_ALL_FAILING_RADAR_SITES_PASS",JSON.stringify(result));
  if(faults.length)console.log("LIVE_WEBKIT_MOBILE_NON_FATAL_DIAGNOSTICS",JSON.stringify(faults.slice(0,12)));
}catch(e){
  console.log("LIVE_WEBKIT_MOBILE_ALL_FAILING_RADAR_SITES_FAIL",JSON.stringify({error:String(e),faults:faults.slice(0,12)}));
  throw e;
}finally{await browser.close();}
