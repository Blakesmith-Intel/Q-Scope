import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium,webkit} from "playwright";

const css=readFileSync("_site/src/power-outage-suburb-explorer-v1.css","utf8");
const providerMarkup='<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<style>'+css+'</style></head><body><dialog id="powerOutageExplorer" open data-report-view="provider">'+
  '<header class="outage-explorer-heading"><strong>Power outages by provider</strong><button>Close</button></header>'+
  '<div class="outage-explorer-toolbar"><label>Find a council<input value=""></label>'+
  '<button id="outageByProviderReport">Report by LGA</button><button>Refresh</button></div>'+
  '<p class="outage-explorer-feed-status">33 unplanned outages / 1,049 customers</p>'+
  '<p class="outage-explorer-count">33 distinct outages - 1,049 customers</p>'+
  '<div class="outage-explorer-results"><table class="outage-provider-table">'+
  '<thead><tr><th>Provider</th><th>Outages</th><th>Customers affected</th><th>Feed</th></tr></thead>'+
  '<tbody><tr><td>Energex</td><td class="outage-provider-number">6</td>'+
  '<td class="outage-provider-number">84</td><td class="outage-provider-status">Current'+
  '<small class="outage-provider-source-time">Record 04/11 01:00 AEST</small></td></tr>'+
  '<tr><td>Ergon</td><td class="outage-provider-number">27</td>'+
  '<td class="outage-provider-number">965</td><td>Current</td></tr>'+
  '<tr><td>Essential Energy</td><td class="outage-provider-number">0</td>'+
  '<td class="outage-provider-number">0</td><td>Current</td></tr>'+
  '<tr><th>Statewide total</th><td class="outage-provider-number">33</td>'+
  '<td class="outage-provider-number">1,049</td><td>All three feeds</td></tr></tbody></table>'+
  '</div><p class="outage-explorer-footer">Provider incidents are unique, not summed across councils.</p>'+
  '</dialog></body></html>';

const platform=process.env.STORMTRACKER_BROWSER==="mobile"?"mobile":"desktop";
const browser=await (platform==="mobile"?webkit:chromium).launch({headless:true});
try{
  for(const width of [1200,390]){
    const page=await browser.newPage({viewport:{width,height:800},deviceScaleFactor:1});
    await page.setContent(providerMarkup);
    const result=await page.evaluate(()=>{
      const root=document.querySelector("#powerOutageExplorer");
      const results=document.querySelector(".outage-explorer-results");
      const table=document.querySelector(".outage-provider-table");
      const cells=[...table.querySelectorAll("tbody td")];
      const labels=[...document.querySelectorAll(".outage-explorer-toolbar label")];
      const rows=[...table.querySelectorAll("tbody tr")];
      const toolbar=document.querySelector(".outage-explorer-toolbar");
      return {
        panelWidth:root.getBoundingClientRect().width,
        viewportWidth:innerWidth,
        resultsScrollWidth:results.scrollWidth,
        resultsClientWidth:results.clientWidth,
        tableWidth:table.getBoundingClientRect().width,
        cells:cells.map(cell=>({
          radius:getComputedStyle(cell).borderRadius,
          display:getComputedStyle(cell).display,
          height:cell.getBoundingClientRect().height
        })),
        rows:rows.map(row=>row.getBoundingClientRect().height),
        searchDisplay:getComputedStyle(labels[0]).display,
        toolbarScrollWidth:toolbar.scrollWidth,
        toolbarWidth:toolbar.clientWidth
      };
    });
    assert.ok(result.panelWidth<=result.viewportWidth,
      platform+" "+width+"px: popup exceeds viewport");
    assert.ok(result.tableWidth<=result.resultsClientWidth+2,
      platform+" "+width+"px: provider table causes horizontal scrolling");
    assert.ok(result.resultsScrollWidth<=result.resultsClientWidth+2,
      platform+" "+width+"px: provider report overflow");
    assert.ok(result.toolbarScrollWidth<=result.toolbarWidth+2,
      platform+" "+width+"px: popup toolbar overflow");
    assert.equal(result.searchDisplay,"none",
      "Provider report must not show irrelevant LGA search");
    assert.ok(result.cells.every(cell=>cell.radius==="0px"&&cell.display==="table-cell"),
      "Provider count cells must not inherit circular badges");
    assert.ok(result.rows.every(height=>height<115),
      platform+" "+width+"px: provider report has oversized rows");
    await page.evaluate(()=>document.querySelector("#powerOutageExplorer").dataset.reportView="lga");
    assert.notEqual(await page.locator(".outage-explorer-toolbar label").evaluate(e=>getComputedStyle(e).display),"none",
      "LGA report must restore council search");
    await page.close();
    console.log("POWER_PROVIDER_REPORT_LAYOUT_PASS",platform,width+"px",JSON.stringify(result.rows));
  }
}finally{
  await browser.close();
}