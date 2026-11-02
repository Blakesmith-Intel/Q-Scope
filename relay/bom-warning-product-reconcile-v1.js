// Deterministic latest-issued state of QLD BoM warning products. One source
// refresh produces one atomic replacement. A newer CAP Cancel always
// supersedes older warning geometry; a revised warning supersedes its old shape.
import {QLD_WARNING_PRODUCTS} from "../frontend/src/context-layers/bom-qld-warning-product-catalogue-v1.js";
import {classifyPublishedBoMThunderstormHazards} from "../frontend/src/context-layers/bom-warning-hazard-terms-v1.js";

export const WATCHED_QLD_PRODUCT_CODES=Object.freeze(Object.keys(QLD_WARNING_PRODUCTS));
const validMs=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const stateRow=(status,notice=null,count=0)=>({
  status,issuedUtc:notice?.issuedUtc??null,
  expiresUtc:notice?.expiresUtc??null,count,
  // CAP text remains useful if the original source supplies no geometry.
  // These are official bulletin fields, not generated or geocoded polygons.
  headline:notice?.headline??"",
  description:notice?.description??"",
  instruction:notice?.instruction??"",
  areaDescription:notice?.areaDescription??"",
  bulletinUrl:notice?.bulletinUrl??"",
  // Preserve official high-end wording even when the issued bulletin has no
  // verifiable polygon. Never turn warning text into tracked cell features.
  hazardAssessment:notice&&["IDQ21033","IDQ21035"].includes(notice.productCode)
   ?classifyPublishedBoMThunderstormHazards(notice):null
});
export function reconcileLatestBoMWarnings(messages,{complete=true,nowMs=Date.now(),qldCurrentIndex=null}={}){
  const candidates=new Map();
  let malformed=0;
  for(const message of messages??[]){
    if(message?.failed){malformed++;continue;}
    const notice=message?.notice;
    if(!notice||!WATCHED_QLD_PRODUCT_CODES.includes(notice.productCode))continue;
    const issued=validMs(notice.issuedUtc);
    if(!Number.isFinite(issued)||issued>nowMs+300000)continue;
    const list=candidates.get(notice.productCode)??[];
    list.push({notice,issued,warnings:Array.isArray(message.warnings)?message.warnings:[]});
    candidates.set(notice.productCode,list);
  }
  const products={},warnings=[];
  const allComplete=complete&&malformed===0;
  const officialActive=qldCurrentIndex?.verified===true&&Array.isArray(qldCurrentIndex.activeCodes)?
    new Set(qldCurrentIndex.activeCodes):null;
  const officialIndexAt=validMs(qldCurrentIndex?.checkedUtc);
  for(const code of WATCHED_QLD_PRODUCT_CODES){
    const options=(candidates.get(code)??[]).sort((a,b)=>b.issued-a.issued||
      (a.notice.status==="cancelled"?-1:1));
    if(!options.length){
      // Only a completely fetched, parsed official index can show no active
      // warnings. A timeout or incomplete source never means "all clear".
      products[code]=stateRow(officialActive?
        (officialActive.has(code)?"listed-active":"no-active"):
        (allComplete?"no-active":"unavailable"));
      continue;
    }
    const latest=options[0],notice=latest.notice;
    // The freshly published official CURRENT index takes precedence over an
    // older issued CAP record still present in bounded national RSS history.
    // Otherwise a cancelled warning remains falsely active until that old
    // CAP issue drops out of the sample. Never suppress a NEWER CAP issue
    // against an index generated before the issue was published.
    if(officialActive&&!officialActive.has(code)&&
       Number.isFinite(officialIndexAt)&&officialIndexAt>=latest.issued){
      products[code]=stateRow(notice.status==="cancelled"?"cancelled":"no-active",notice);
      continue;
    }
    if(notice.status==="cancelled"){
      // A newer cancellation overrides an older still-active index; a newer
      // live current-list entry overrides older CAP cancellation history.
      const newerIndex=officialActive?.has(code)&&
        (!Number.isFinite(officialIndexAt)||officialIndexAt>=latest.issued);
      products[code]=stateRow(newerIndex?"listed-active":"cancelled",notice);
      continue;
    }
    if(notice.status==="expired"){
      products[code]=stateRow(officialActive?.has(code)?"listed-active":"no-active",notice);
      continue;
    }
    const latestWarnings=options.filter(x=>x.issued===latest.issued)
      .flatMap(x=>x.warnings);
    // A newer CAP notice does not necessarily cancel another separately
    // issued, still-current warning area using the same regional product.
    // Include older issues ONLY if the current official Queensland index
    // verifies the product active and each area is government GIS source-
    // authenticated and matches its own unexpired original CAP issue.
    // Older standalone CAP polygons are NOT republished on revision.
    const concurrentSourceWarnings=officialActive?.has(code)?
      options.filter(x=>x.issued!==latest.issued&&
        x.notice.status==="issued"&&validMs(x.notice.expiresUtc)>nowMs)
        .flatMap(x=>x.warnings)
        .filter(w=>w.warningGeometrySource&&w.sourceProduct):
      [];
    const currentWarnings=[...latestWarnings,...concurrentSourceWarnings]
      .filter(w=>w.productCode===code && validMs(w.expiresUtc)>nowMs &&
        validMs(w.issuedUtc)<=nowMs && w.official===true);
    const unique=[...new Map(currentWarnings.map(w=>[w.id,w])).values()];
    if(!unique.length){
      // An explicit live warning without valid geometry is NOT a no-warning
      // response, even when the enclosing RSS request succeeded.
      products[code]=stateRow("geometry-unavailable",notice);
      continue;
    }
    products[code]=stateRow("active",notice,unique.length);
    warnings.push(...unique);
  }
  return {products,warnings,sourceComplete:allComplete};
}
