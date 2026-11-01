// BoM Queensland warning summary is an official product CURRENT index, while
// WMO CAP RSS is a bounded national history of issues. A missing product from
// the first 22 CAP records does NOT mean QLD has no such warning.
// Only a successfully downloaded, fresh, correctly structured Queensland
// current-warnings list can affirm a product's verified absence.
const QLD_WARNING_INDEX_URL="https://www.bom.gov.au/qld/warnings.shtml";
const CODES=["IDQ21033","IDQ21035","IDQ21037","IDQ21038"];
export function parseCurrentQldBoMWarningsIndex(html,{nowMs=Date.now()}={}){
 if(typeof html!=="string"||html.length<1000||html.length>750000||
    !/Queensland Warnings Summary/i.test(html))return null;
 const start=html.search(/Warnings\s+current\s*:/i);
 if(start<0)return null;
 const listEnd=html.indexOf("</ul>",start);
 if(listEnd<0||listEnd-start>35000)return null;
 // BoM puts the clock in a <strong> tag and sometimes a newline before
 // 'on Friday 30 October'. Normalise only the timestamp paragraph.
 const timestamp=html.match(/<p\b[^>]*id=["']timestamp["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]
   ?.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()??"";
 const created=timestamp.match(/This page was created at\s*(\d{1,2}):(\d{2})\s+on\s+\w+\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s*\(UTC\)/i);
 if(!created)return null;
 const month=["january","february","march","april","may","june","july",
   "august","september","october","november","december"]
   .indexOf(created[4].toLowerCase());
 if(month<0)return null;
 const dateMs=Date.UTC(Number(created[5]),month,Number(created[3]),Number(created[1]),Number(created[2]));
 if(!Number.isFinite(dateMs)||dateMs>nowMs+5*60000||nowMs-dateMs>20*60000)return null;
 const body=html.slice(start,listEnd);
 const active=new Set();
 // The Queensland "Warnings current" list ALSO links cancellation notices.
 // An IDQ product link alone is not evidence that its warning is active.
 // Only an explicitly non-cancellation entry is an active warning; this
 // still supports another independently active entry for the same product.
 for(const m of body.matchAll(/<a\s+[^>]*href\s*=\s*["'](?:https?:\/\/(?:www\.)?bom\.gov\.au)?\/(?:products\/(IDQ\d{5})\.shtml|warning\/[\w-]+\/(IDQ\d{5}))(?:\?[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const code=(m[1]||m[2]).toUpperCase();
  const title=m[3].replace(/<[^>]*>/g," ").replace(/&(?:nbsp|amp);/gi," ").trim();
  if(/\b(?:cancellation|cancelled|canceled|final)\b/i.test(title))continue;
  if(CODES.includes(code))active.add(code);
 }
 // All-clear is asserted only against THIS verified current-product listing,
 // never merely from the absence of a matching item in truncated WMO RSS.
 return {source:"Official BoM Queensland current warnings summary",
   checkedUtc:new Date(dateMs).toISOString(),
   activeCodes:[...active],verified:true};
}
export async function fetchCurrentQldBoMWarningsIndex({fetchImpl=fetch,nowMs=Date.now()}={}){
 const response=await fetchImpl(QLD_WARNING_INDEX_URL,{
  headers:{Accept:"text/html"},signal:AbortSignal.timeout(12500),
  cf:{cacheTtl:90,cacheEverything:true}
 });
 if(!response.ok)throw Error("BoM Queensland current warnings index HTTP "+response.status);
 const html=await response.text();
 const index=parseCurrentQldBoMWarningsIndex(html,{nowMs});
 if(!index)throw Error("BoM Queensland current warnings index unverified, stale or incomplete");
 return index;
}
