// Isolated QA: bound simultaneous BoM relay requests and halt futile retry
// storms without fabricating, interpolating or quietly substituting any data.
// HTTP 400 is cached by exact (tile + source timestamp) URL. A permission/
// service outage temporarily opens a circuit for THIS WMTS request class.
export function createRadarRequestPressureGuard({
  // BoM/Cloudflare may refuse bursty multi-site tile fetches (HTTP 403).
  // Two simultaneous tiles preserve interactive throughput without bursts.
  maxConcurrent=2,maxPending=72,
  // Published-but-not-ready BoM tiles can recover within a minute.
  negativeTtlMs=45000,deniedCooldownMs=30000,
  serviceCooldownMs=15000,now=()=>Date.now()
}={}) {
  const inflight=new Map(), negative=new Map(), queue=[];
  let active=0,blockedUntil=0,blockedStatus=0;
  let consecutiveRefusals=0,lastRefusalAt=0;
  const metrics={started:0,joined:0,negativeHits:0,blocked:0,peakActive:0};
  const statusError=(status,reason="")=>{
    const e=new Error("Image request failed: HTTP "+status+(reason?" ("+reason+")":""));
    e.status=status;return e;
  };
  function next() {
    const time=now();
    for(const [key,entry] of negative)if(entry.until<=time)negative.delete(key);
    if(time<blockedUntil){
      while(queue.length) {
        const item=queue.shift();
        inflight.delete(item.url);
        metrics.blocked++;
        item.reject(statusError(blockedStatus,"relay cooldown"));
      }
      return;
    }
    while(active<maxConcurrent && queue.length){
      const item=queue.shift();
      active++;metrics.started++;metrics.peakActive=Math.max(active,metrics.peakActive);
      Promise.resolve().then(item.fetchTile).then(
        result=>{
          active--;inflight.delete(item.url);
          // A successful native PNG read breaks an apparent denial streak;
          // independent radar tiles must not be mistaken for a global ban.
          consecutiveRefusals=0;
          item.resolve(result);next();
        },
        error=>{
          active--;inflight.delete(item.url);
          const status=Number(error?.status)||0;
          if(status===400 || status===403) {
            // Exact-URL 403 backoff is short-lived and independently scoped
            // by genuine tile coordinate + published UTC. No cross-site
            // quarantine or substitution of a different observation.
            negative.set(item.url,{
              until:now()+(status===403?deniedCooldownMs:negativeTtlMs),
              status
            });
            if(negative.size>320)negative.delete(negative.keys().next().value);
          }
          // A single HTTP 403 on a geographic WMTS tile may be local to
          // that query. Do NOT block every radar on one refused tile.
          // Three fresh refusals in 30 seconds or one explicit HTTP 429
          // indicate wider access pressure and justify brief backoff.
          const t=now();
          if(status===403){
            consecutiveRefusals=(t-lastRefusalAt<=30000)
              ? consecutiveRefusals+1 : 1;
            lastRefusalAt=t;
          } else if(status!==429 && status!==400){
            consecutiveRefusals=0;
          }
          if(status===429 || (status===403 && consecutiveRefusals>=3)){
            const until=t+deniedCooldownMs;
            if(until>blockedUntil){blockedUntil=until;blockedStatus=status;}
          }
          item.reject(error);
          next();
        }
      );
    }
  }
  function run(url,fetchTile) {
    if(typeof fetchTile!=="function" || !url)throw TypeError("URL and loader required");
    const cached=negative.get(url),time=now();
    if(cached && cached.until>time){
      metrics.negativeHits++;
      return Promise.reject(statusError(cached.status,
        cached.status===403?"source refusal cooldown":"known unavailable tile"));
    }
    if(time<blockedUntil){
      metrics.blocked++;return Promise.reject(statusError(blockedStatus,"relay cooldown"));
    }
    const joined=inflight.get(url);
    if(joined){metrics.joined++;return joined;}
    if(queue.length>=maxPending)
      return Promise.reject(statusError(429,"browser request queue full"));
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    inflight.set(url,promise);
    queue.push({url,fetchTile,resolve,reject});
    next();
    return promise;
  }
  return {run,
    snapshot:()=>({...metrics,active,queued:queue.length,
      blockedUntil,negativeCount:negative.size})
  };
}
