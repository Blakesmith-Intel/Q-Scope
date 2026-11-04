// One-shot, read-only deployment measurement. It does not poll or load radar.
// A station can be unpublished or BoM can refuse access; neither is a
// failed production release. Logs cache and latency evidence, never guesses.
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const origin="https://blakesmith-intel.github.io";
const urls=[
  base+"/river-recent-history?product=IDQ65388&station=540384",
  base+"/river-height-bulletins"
];
for(const endpoint of urls){
  const path=new URL(endpoint).pathname;
  for(let i=0;i<2;i++){
    const started=Date.now();
    try{
      const response=await fetch(endpoint,{
        headers:{Origin:origin,Accept:"application/json"},
        signal:AbortSignal.timeout(18000)
      });
      // Read body to validate completion; avoid dumping river heights or
      // printing huge bulletin responses to CI logs.
      const data=await response.text();
      const line={
        route:path,request:i+1,http:response.status,wallMs:Date.now()-started,
        relayCache:response.headers.get("X-StormTracker-Relay-Cache")??"not-exposed",
        relayMs:response.headers.get("X-StormTracker-Relay-Ms"),
        cacheStatus:response.headers.get("CF-Cache-Status")??"not-exposed",
        observationAgeSec:response.headers.get("X-StormTracker-Observation-Age-Sec"),
        responseBytes:data.length
      };
      console.log("RELAY_EFFICIENCY_MEASUREMENT",JSON.stringify(line));
      if(!response.ok)break;
    }catch(error){
      console.log("RELAY_EFFICIENCY_ADVISORY",
        JSON.stringify({route:path,error:String(error?.message??error)}));
      break;
    }
  }
}
