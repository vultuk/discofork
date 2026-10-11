(()=>{var a={};a.id=833,a.ids=[833],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},2397:(a,b,c)=>{"use strict";c.d(b,{CC:()=>n,fs:()=>o,nr:()=>h,qK:()=>g});var d=c(70719),e=c(66235);let f=null;function g(){return!!process.env.REDIS_URL}async function h(){if(!process.env.REDIS_URL)throw Error("REDIS_URL is required.");return f||(f=(0,d.createClient)({url:process.env.REDIS_URL})).on("error",a=>{console.error("Redis error:",a)}),f.isOpen||await f.connect(),f}function i(a){return`${e.iZ}${a}`}let j=`
local dedupeKey = KEYS[1]
local queueKey = KEYS[2]
local fullName = ARGV[1]
local ttlSeconds = ARGV[2]

if redis.call("SET", dedupeKey, "1", "NX", "EX", ttlSeconds) then
  redis.call("LPUSH", queueKey, fullName)
  return 1
end

return 0
`;async function k(a,b){let[c,d]=await Promise.all([a.sendCommand(["LPOS",e.$D,b]),a.sendCommand(["LPOS",e.rd,b])]);return"number"==typeof c||"number"==typeof d}async function l(a,b){await a.set(i(b),"1",{EX:e.Sq})}async function m(a,b){return 1===Number(await a.sendCommand(["EVAL",j,"2",i(b),e.$D,b,String(e.Sq)]))}async function n(a){let b=await h();return await k(b,a)?(await l(b,a),!1):m(b,a)}async function o(a){let b=await h(),[c,d,f]=await Promise.all([b.sendCommand(["LPOS",e.$D,a]),b.lLen(e.$D),b.sendCommand(["LPOS",e.rd,a])]);return{queuePosition:"number"==typeof c&&d>0?Math.max(1,d-c):null,processing:"number"==typeof f}}},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},6851:(a,b,c)=>{"use strict";c.d(b,{OW:()=>e,S6:()=>d,T0:()=>f});let d=25,e=["updated","forks","stars"],f=["all","queued","ready","processing","failed"]},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},17797:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{Db:()=>k,G_:()=>m,aU:()=>l,f9:()=>i,o_:()=>h});var e=c(74152),f=c(30637),g=a([f]);async function h(a){return(await (0,f.P)(`select
      full_name,
      owner,
      repo,
      github_url,
      status,
      report_json,
      error_message,
      last_requested_at,
      queued_at,
      processing_started_at,
      cached_at,
      retry_count,
      retry_state,
      next_retry_at,
      last_failed_at,
      last_error_message,
      failure_history,
      created_at,
      updated_at
    from repo_reports
    where full_name = $1`,[a]))[0]??null}async function i(a,b,c){let d=`${a}/${b}`,e=`https://github.com/${d}`;await (0,f.P)(`insert into repo_reports (
      full_name, owner, repo, github_url, status, last_requested_at, queued_at, updated_at
    ) values ($1, $2, $3, $4, 'queued', now(), now(), now())
    on conflict (full_name) do update
    set
      owner = excluded.owner,
      repo = excluded.repo,
      github_url = excluded.github_url,
      status = case
        when repo_reports.status = 'ready' and repo_reports.report_json is not null and $5 = false then repo_reports.status
        when repo_reports.status in ('queued', 'processing') and $5 = false then repo_reports.status
        else 'queued'
      end,
      error_message = case
        when (repo_reports.status = 'ready' and repo_reports.report_json is not null and $5 = false)
          or (repo_reports.status in ('queued', 'processing') and $5 = false)
          then repo_reports.error_message
        else null
      end,
      last_requested_at = now(),
      queued_at = case
        when $5 = true then now()
        else coalesce(repo_reports.queued_at, now())
      end,
      retry_count = case when $5 = true then 0 else repo_reports.retry_count end,
      retry_state = case when $5 = true then 'none' else repo_reports.retry_state end,
      next_retry_at = case when $5 = true then null else repo_reports.next_retry_at end,
      last_failed_at = case when $5 = true then null else repo_reports.last_failed_at end,
      last_error_message = case when $5 = true then null else repo_reports.last_error_message end,
      failure_history = case when $5 = true then '[]'::jsonb else repo_reports.failure_history end,
      updated_at = now()`,[d,a,b,e,c])}function j(a,b=""){let c=[`not (${e.cb})`],d=[],f=b.trim();return"all"!==a&&(d.push(a),c.push(`status = $${d.length}`)),f&&(d.push(`%${f.replaceAll("\\","\\\\").replaceAll("%","\\%").replaceAll("_","\\_")}%`),c.push(`full_name ilike $${d.length} escape '\\'`)),{clause:`where ${c.join(" and ")}`,params:d}}async function k(a,b,c,d,e=""){let g=Math.max(1,a),h=Math.max(1,b),i=j("all"),l=j(d,e),m=(await (0,f.P)(`select
      count(*)::int as total,
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status in ('queued', 'processing'))::int as pending,
      count(*) filter (where status = 'ready')::int as cached,
      count(*) filter (where status = 'failed')::int as failed
    from repo_reports
    ${i.clause}`))[0]??{total:0,queued:0,processing:0,pending:0,cached:0,failed:0},n=await (0,f.P)(`select count(*)::text as count
    from repo_reports
    ${l.clause}`,l.params),o=Number.parseInt(n[0]?.count??"0",10),p=[...l.params,h,(g-1)*h];return{items:await (0,f.P)(`select
      full_name,
      owner,
      repo,
      github_url,
      status,
      queued_at,
      processing_started_at,
      cached_at,
      updated_at,
      retry_count,
      retry_state,
      next_retry_at,
      last_failed_at,
      nullif(report_json->'upstream'->'metadata'->>'stargazerCount', '')::int as stars,
      nullif(report_json->'upstream'->'metadata'->>'forkCount', '')::int as forks,
      report_json->'upstream'->'metadata'->>'defaultBranch' as default_branch,
      report_json->'upstream'->'metadata'->>'pushedAt' as last_pushed_at,
      report_json->'upstream'->'analysis'->>'summary' as upstream_summary,
      coalesce(jsonb_array_length(coalesce(report_json->'forks', '[]'::jsonb)), 0) as fork_brief_count
    from repo_reports
    ${l.clause}
    order by ${"forks"===c?"coalesce(nullif(report_json->'upstream'->'metadata'->>'forkCount', '')::int, -1) desc, updated_at desc, full_name asc":"stars"===c?"coalesce(nullif(report_json->'upstream'->'metadata'->>'stargazerCount', '')::int, -1) desc, updated_at desc, full_name asc":"updated_at desc, full_name asc"}
    limit $${p.length-1}
    offset $${p.length}`,p),stats:m,total:o}}async function l(){let a=j("failed");return(await (0,f.P)(`select full_name
    from repo_reports
    ${a.clause}
    order by updated_at desc, full_name asc`,a.params)).map(a=>a.full_name)}async function m(a){0!==a.length&&await (0,f.P)(`update repo_reports
    set status = 'queued',
        error_message = null,
        queued_at = now(),
        processing_started_at = null,
        retry_count = 0,
        retry_state = 'none',
        next_retry_at = null,
        last_failed_at = null,
        last_error_message = null,
        failure_history = '[]'::jsonb,
        updated_at = now(),
        last_requested_at = now()
    where full_name = any($1::text[])`,[a])}f=(g.then?(await g)():g)[0],d()}catch(a){d(a)}})},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},30637:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{P:()=>h,W:()=>g});var e=c(64939),f=a([e]);e=(f.then?(await f)():f)[0];let i=null;function g(){return!!process.env.DATABASE_URL}async function h(a,b=[]){return(await (function(){if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required.");return i||(i=new e.Pool({connectionString:process.env.DATABASE_URL})),i})().query(a,b)).rows}d()}catch(a){d(a)}})},31068:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{GET:()=>l});var e=c(10641),f=c(6851),g=c(89706),h=c(30637),i=c(2397),j=c(17797),k=a([h,j]);async function l(a){let b=(0,g.RX)(a.nextUrl.searchParams.get("page")),c=(0,g.Gu)(a.nextUrl.searchParams.get("order")),d=(0,g.Wo)(a.nextUrl.searchParams.get("status")),k=(0,g.I3)(a.nextUrl.searchParams.get("query"));if(!(0,h.W)()){let a={items:[],stats:{total:0,queued:0,processing:0,pending:0,cached:0,failed:0},order:c,statusFilter:d,query:k,page:b,pageSize:f.S6,total:0,totalPages:0,hasPrevious:b>1,hasNext:!1,databaseEnabled:!1,queueEnabled:(0,i.qK)()};return e.NextResponse.json(a)}let{items:l,stats:m,total:n}=await (0,j.Db)(b,f.S6,c,d,k),o=0===n?0:Math.ceil(n/f.S6),p={items:l.map(a=>({fullName:a.full_name,owner:a.owner,repo:a.repo,githubUrl:a.github_url,status:a.status,queuedAt:a.queued_at,processingStartedAt:a.processing_started_at,cachedAt:a.cached_at,updatedAt:a.updated_at,retryCount:a.retry_count,retryState:a.retry_state,nextRetryAt:a.next_retry_at,lastFailedAt:a.last_failed_at,stars:a.stars,forks:a.forks,defaultBranch:a.default_branch,lastPushedAt:a.last_pushed_at,upstreamSummary:a.upstream_summary,forkBriefCount:a.fork_brief_count})),stats:m,order:c,statusFilter:d,query:k,page:b,pageSize:f.S6,total:n,totalPages:o,hasPrevious:b>1,hasNext:b<o,databaseEnabled:!0,queueEnabled:(0,i.qK)()};return e.NextResponse.json(p)}[h,j]=k.then?(await k)():k,d()}catch(a){d(a)}})},34589:a=>{"use strict";a.exports=require("node:assert")},35672:a=>{"use strict";a.exports=require("dns/promises")},41692:a=>{"use strict";a.exports=require("node:tls")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},47872:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{handler:()=>x,patchFetch:()=>w,routeModule:()=>y,serverHooks:()=>B,workAsyncStorage:()=>z,workUnitAsyncStorage:()=>A});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(31068),v=a([u]);u=(v.then?(await v)():v)[0];let y=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/repos/route",pathname:"/api/repos",filename:"route",bundlePath:"app/api/repos/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/home/ec2-user/Development/Business/SchemaLabs/discofork-worktrees/issue-57-repo-comparison-bookmarks-export/web/src/app/api/repos/route.ts",nextConfigOutput:"",userland:u}),{workAsyncStorage:z,workUnitAsyncStorage:A,serverHooks:B}=y;function w(){return(0,g.patchFetch)({workAsyncStorage:z,workUnitAsyncStorage:A})}async function x(a,b,c){var d;let e="/api/repos/route";"/index"===e&&(e="/");let g=await y.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(z.dynamicRoutes[E]||z.routes[D]);if(F&&!x){let a=!!z.routes[D],b=z.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||y.isDev||x||(G=D,G="/index"===G?"/":G);let H=!0===y.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>y.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>y.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await y.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await y.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await y.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}d()}catch(a){d(a)}})},53053:a=>{"use strict";a.exports=require("node:diagnostics_channel")},58500:a=>{"use strict";a.exports=require("node:timers/promises")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64939:a=>{"use strict";a.exports=import("pg")},66235:(a,b,c)=>{"use strict";c.d(b,{$D:()=>d,Sq:()=>g,bU:()=>i,eH:()=>j,iZ:()=>f,qR:()=>h,rd:()=>e});let d="discofork:repo-jobs",e="discofork:repo-jobs:processing",f="discofork:repo-job:",g=1800,h="discofork:repo-progress:",i="discofork:github-api:pause-until",j="discofork:github-rate-limit:snapshot:v1"},73136:a=>{"use strict";a.exports=require("node:url")},74152:(a,b,c)=>{"use strict";c.d(b,{OE:()=>j,cb:()=>i});let d=[".well-known"],e=["admin/.env","wp-admin/admin-ajax.php"],f=new Set(d),g=new Set(e);function h(a){return a.map(a=>`'${a.replaceAll("'","''")}'`).join(", ")}let i=`owner like '.%' or position('%' in owner) > 0 or position('%' in repo) > 0 or position('/' in owner) > 0 or position('/' in repo) > 0 or position(chr(92) in owner) > 0 or position(chr(92) in repo) > 0 or position('..' in owner) > 0 or position('..' in repo) > 0 or lower(owner) in (${h(d)}) or lower(owner || '/' || repo) in (${h(e)})`;function j(a,b){let c=a.toLowerCase(),d=b.toLowerCase(),e=`${c}/${d}`;return a.startsWith(".")?"Owner segment starts with a hidden-path prefix.":a.includes("%")||b.includes("%")?"Owner or repository name still contains URL-encoded path characters.":a.includes("/")||b.includes("/")||a.includes("\\")||b.includes("\\")?"Owner or repository name contains path separators.":a.includes("..")||b.includes("..")?"Owner or repository name contains path traversal markers.":f.has(c)?"Owner segment matches a known web probe path.":g.has(e)?"Owner and repository pair matches a known web probe route.":null}},77030:a=>{"use strict";a.exports=require("node:net")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},78474:a=>{"use strict";a.exports=require("node:events")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},89706:(a,b,c)=>{"use strict";c.d(b,{Ew:()=>i,Gu:()=>f,I3:()=>h,RX:()=>e,Wo:()=>g});var d=c(6851);function e(a){let b=Number.parseInt(a??"1",10);return Number.isFinite(b)&&b>0?b:1}function f(a){return d.OW.includes(a??"")?a??"updated":"updated"}function g(a){return d.T0.includes(a??"")?a??"all":"all"}function h(a){return a?.trim()??""}function i(a,b,c,d){let e=new URLSearchParams;return a>1&&e.set("page",String(a)),e.set("order",b),e.set("status",c),d&&e.set("query",d),`/repos?${e.toString()}`}},91645:a=>{"use strict";a.exports=require("net")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[873,719,692],()=>b(b.s=47872));module.exports=c})();