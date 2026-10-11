"use strict";exports.id=992,exports.ids=[992],exports.modules={2397:(a,b,c)=>{c.d(b,{CC:()=>n,fs:()=>o,nr:()=>h,qK:()=>g});var d=c(70719),e=c(66235);let f=null;function g(){return!!process.env.REDIS_URL}async function h(){if(!process.env.REDIS_URL)throw Error("REDIS_URL is required.");return f||(f=(0,d.createClient)({url:process.env.REDIS_URL})).on("error",a=>{console.error("Redis error:",a)}),f.isOpen||await f.connect(),f}function i(a){return`${e.iZ}${a}`}let j=`
local dedupeKey = KEYS[1]
local queueKey = KEYS[2]
local fullName = ARGV[1]
local ttlSeconds = ARGV[2]

if redis.call("SET", dedupeKey, "1", "NX", "EX", ttlSeconds) then
  redis.call("LPUSH", queueKey, fullName)
  return 1
end

return 0
`;async function k(a,b){let[c,d]=await Promise.all([a.sendCommand(["LPOS",e.$D,b]),a.sendCommand(["LPOS",e.rd,b])]);return"number"==typeof c||"number"==typeof d}async function l(a,b){await a.set(i(b),"1",{EX:e.Sq})}async function m(a,b){return 1===Number(await a.sendCommand(["EVAL",j,"2",i(b),e.$D,b,String(e.Sq)]))}async function n(a){let b=await h();return await k(b,a)?(await l(b,a),!1):m(b,a)}async function o(a){let b=await h(),[c,d,f]=await Promise.all([b.sendCommand(["LPOS",e.$D,a]),b.lLen(e.$D),b.sendCommand(["LPOS",e.rd,a])]);return{queuePosition:"number"==typeof c&&d>0?Math.max(1,d-c):null,processing:"number"==typeof f}}},17797:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{Db:()=>k,G_:()=>m,aU:()=>l,f9:()=>i,o_:()=>h});var e=c(74152),f=c(30637),g=a([f]);async function h(a){return(await (0,f.P)(`select
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
    where full_name = any($1::text[])`,[a])}f=(g.then?(await g)():g)[0],d()}catch(a){d(a)}})},30637:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{P:()=>h,W:()=>g});var e=c(64939),f=a([e]);e=(f.then?(await f)():f)[0];let i=null;function g(){return!!process.env.DATABASE_URL}async function h(a,b=[]){return(await (function(){if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required.");return i||(i=new e.Pool({connectionString:process.env.DATABASE_URL})),i})().query(a,b)).rows}d()}catch(a){d(a)}})},51992:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{sr:()=>w,wN:()=>t,xY:()=>x});var e=c(74515),f=c(30637),g=c(62274),h=c(2397),i=c(17797),j=c(74152),k=a([f,g,i]);[f,g,i]=k.then?(await k)():k;let s="discofork:github-repo-exists:";class t extends Error{constructor(a){super(`Repository not found on GitHub: ${a}`),this.name="RepositoryNotFoundError"}}function l(a,b){if((0,j.OE)(a,b))throw new t(`${a}/${b}`)}function m(a){return a?"string"==typeof a?a:a instanceof Date?a.toISOString():"number"==typeof a?new Date(a).toISOString():String(a):null}async function n(a){if(!(0,h.qK)())return null;try{let b=await (0,h.nr)(),c=await b.get(`${s}${a}`);if("1"===c)return!0;if("0"===c)return!1}catch{}return null}async function o(a,b){if((0,h.qK)())try{let c=await (0,h.nr)();await c.set(`${s}${a}`,b?"1":"0",{EX:b?3600:900})}catch{}}async function p(a){let b=await n(a);if(!0===b)return;if(!1===b)throw new t(a);let c=process.env.GH_TOKEN??process.env.GITHUB_TOKEN??null;if(!c)return;let d=await fetch(`https://api.github.com/repos/${a}`,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${c}`,"X-GitHub-Api-Version":"2026-03-10"},cache:"no-store"});if(404===d.status)throw await o(a,!1),new t(a);d.ok&&await o(a,!0)}let u=new Map([["vultuk/discofork",{kind:"cached",owner:"vultuk",repo:"discofork",fullName:"vultuk/discofork",githubUrl:"https://github.com/vultuk/discofork",cachedAt:"2026-03-29T18:05:00Z",stats:{stars:18,forks:9,defaultBranch:"main",lastPushedAt:"2026-03-29"},upstreamSummary:"Discofork is a local-first CLI for evaluating GitHub forks with `gh`, `git`, and `codex`. The upstream is focused on practical fork triage: discover forks, exclude low-value mirrors, gather structured diff facts locally, then turn the result into a concise decision brief.",recommendations:{bestMaintained:"someuser/discofork-plus",closestToUpstream:"team/discofork-lite",mostFeatureRich:"infra/discofork-studio",mostOpinionated:"infra/discofork-studio"},forks:[{fullName:"someuser/discofork-plus",maintenance:"active",changeMagnitude:"moderate divergence",summary:"Stays close to upstream while extending export, filtering, and report handling. It looks like a practical operator-focused fork rather than a rewrite.",likelyPurpose:"Keep the core Discofork workflow intact while adding more polished reporting and operator-friendly controls.",bestFor:"Teams that want the upstream CLI workflow but need richer exports, slightly more automation, and a still-manageable merge surface.",additionalFeatures:["Extended report export formats and richer saved run metadata.","More fork filtering presets and stronger default selection controls.","Extra diagnostics around cached analyses and run artifacts."],missingFeatures:["Does not appear to push Discofork beyond its local-first terminal focus.","No sign of a broader hosted or web-backed architecture compared with more ambitious forks."],strengths:["Likely the safest upgrade path for users who already like upstream Discofork.","Adds useful workflow polish without turning the codebase into a different product.","Maintenance posture looks healthier than most forks in this sample."],risks:["Still creates some merge debt relative to upstream.","The extra export and workflow surface adds operational complexity compared with vanilla Discofork."]},{fullName:"team/discofork-lite",maintenance:"active",changeMagnitude:"minor divergence",summary:"Trims the product down toward a simpler review flow and stays visually and structurally close to upstream.",likelyPurpose:"Minimize complexity for users who only need the core repository summary and a lightweight fork comparison workflow.",bestFor:"Users who want the smallest delta from upstream and prefer predictability over feature growth.",additionalFeatures:["Cleaner defaults and reduced UI surface for straightforward comparisons.","Simplified operator flow for teams that do not need advanced export or queueing behavior."],missingFeatures:["Less ambitious reporting and recommendation output than upstream or more feature-heavy forks.","Fewer advanced workflow and debugging affordances."],strengths:["Probably the lowest-risk branch for people who care about staying aligned with upstream.","Easier to understand and maintain than heavily customized forks."],risks:["The reduced surface may feel limiting for users who want deeper analysis artifacts.","A simplification-first fork can lag behind upstream feature additions if scope narrows too far."]},{fullName:"infra/discofork-studio",maintenance:"slowing",changeMagnitude:"significant divergence",summary:"Pushes Discofork toward a broader platform with heavier workflow orchestration, presentation layers, and more opinionated reporting.",likelyPurpose:"Turn Discofork from a focused CLI into a more expansive analysis product with stronger workflow control and presentation features.",bestFor:"Teams that want a more productized fork-analysis stack and are willing to own a larger, more opinionated downstream codebase.",additionalFeatures:["Broader reporting and workflow orchestration beyond the CLI-first upstream shape.","More opinionated presentation and result surfacing for repeated analysis work.","Stronger emphasis on product workflow over minimal local tooling."],missingFeatures:["Less of the upstream tool's simplicity and low-friction local-first feel.","Likely harder to keep tightly synchronized with upstream improvements."],strengths:["Most feature-rich option in this sample.","Could suit teams that want Discofork as a foundation rather than just a terminal tool."],risks:["Merge debt and maintenance cost will be materially higher.","The project may drift away from the original clarity and practicality that make upstream attractive."]}]}],["openai/codex",{kind:"cached",owner:"openai",repo:"codex",fullName:"openai/codex",githubUrl:"https://github.com/openai/codex",cachedAt:"2026-03-29T16:40:00Z",stats:{stars:132207,forks:14162,defaultBranch:"dev",lastPushedAt:"2026-03-29"},upstreamSummary:"Codex is OpenAI’s open source coding agent repo. The upstream is geared toward practical agent execution, terminal workflows, and tool-driven software changes rather than a thin SDK or demo shell.",recommendations:{bestMaintained:"DNGgriffin/whispercode",closestToUpstream:"winmin/evil-opencode",mostFeatureRich:"DNGgriffin/whispercode",mostOpinionated:"winmin/evil-opencode"},forks:[{fullName:"DNGgriffin/whispercode",maintenance:"active",changeMagnitude:"significant divergence",summary:"Adds mobile and push-oriented workflow changes while keeping the repo viable as a product fork for teams comfortable owning a larger downstream surface.",likelyPurpose:"Turn Codex into a more productized downstream agent with mobile, pairing, and notification-oriented workflows.",bestFor:"Teams shipping a Codex derivative with notification, pairing, or mobile distribution requirements.",additionalFeatures:["Push and pairing-oriented workflow changes.","Mobile and distribution-specific additions beyond the upstream baseline.","Broader downstream product surface around the core agent workflow."],missingFeatures:["Less alignment with the simplest upstream maintenance path.","Potentially misses some upstream polish while it carries its own product concerns."],strengths:["Likely the strongest maintained fork in the current sample.","Adds meaningful capabilities instead of superficial branding changes.","Useful for teams who want a base for productization, not just experimentation."],risks:["The downstream surface is much larger, so merge cost rises.","Product-specific behavior can pull the codebase away from upstream expectations."]},{fullName:"winmin/evil-opencode",maintenance:"stale",changeMagnitude:"significant divergence",summary:"Looks intentionally less constrained than upstream, with guardrail removal, CI changes, and a much wider compatibility and maintenance risk profile.",likelyPurpose:"Provide a more permissive or less restricted agent variant for users who explicitly want fewer upstream constraints.",bestFor:"Researchers or advanced users looking for a more permissive variant and willing to absorb the maintenance gap.",additionalFeatures:["More permissive downstream behavior than upstream.","Custom CI and packaging adjustments for its own distribution path."],missingFeatures:["Likely lacks some recent upstream fixes and refinements.","May not preserve the same safety and maintenance posture as the parent project."],strengths:["Clearly differentiated from upstream for users with that specific goal.","Can be useful for experimentation where the upstream guardrails are too constraining."],risks:["Staleness materially increases integration risk.","The divergence appears large enough to make future sync work expensive."]}]}]]),v="No cached analysis was found. Redis queueing is unavailable, so this repository cannot be queued right now.";function q(a,b,c,d={}){let e=`${a}/${b}`;return{kind:"queued",owner:a,repo:b,fullName:e,githubUrl:`https://github.com/${e}`,status:"queued",queuedAt:new Date().toISOString(),queuePosition:null,progress:null,errorMessage:null,queueHint:c,liveStatusEnabled:d.liveStatusEnabled??!1,retryCount:0,retryState:"none",nextRetryAt:null,lastFailedAt:null}}async function r(a,b){let c=`${a}/${b}`,d=await (0,i.o_)(c);if(!d)return null;if("ready"===d.status&&d.report_json){var e=d;let a=e.report_json,b=a.upstream?.metadata??{},c=a.recommendations??{};return{kind:"cached",owner:e.owner,repo:e.repo,fullName:e.full_name,githubUrl:e.github_url,cachedAt:m(e.cached_at??a.generatedAt??e.updated_at)??new Date().toISOString(),stats:{stars:b.stargazerCount??0,forks:b.forkCount??0,defaultBranch:b.defaultBranch??"main",lastPushedAt:m(b.pushedAt)??"unknown"},upstreamSummary:a.upstream?.analysis?.summary??"No upstream summary available.",recommendations:{bestMaintained:c.bestMaintained??"None",closestToUpstream:c.closestToUpstream??"None",mostFeatureRich:c.mostFeatureRich??"None",mostOpinionated:c.mostOpinionated??"None"},forks:(a.forks??[]).map(a=>({fullName:a.metadata?.fullName??"unknown/unknown",maintenance:a.analysis?.maintenance??"unknown",changeMagnitude:a.analysis?.changeMagnitude??"unknown",summary:a.analysis?.decisionSummary??"No summary available.",likelyPurpose:a.analysis?.likelyPurpose??"No likely purpose recorded.",bestFor:(a.analysis?.idealUsers??[]).join("; ")||"No ideal-user guidance recorded.",additionalFeatures:a.analysis?.additionalFeatures??[],missingFeatures:a.analysis?.missingFeatures??[],strengths:a.analysis?.strengths??[],risks:a.analysis?.risks??[]}))}}let f=await (0,g.j)(c);return function(a,b,c,d){let e=`${a}/${b}`,f=function(a){switch(a){case"processing":return"processing";case"failed":return"failed";default:return"queued"}}(d?.status??c.status),g=(0,h.qK)()||"processing"===f,i=d?.retryState??c.retry_state,j=d?.queuePosition??null,k=d?.nextRetryAt??c.next_retry_at,l=d?.retryCount??c.retry_count;return{kind:"queued",owner:a,repo:b,fullName:e,githubUrl:`https://github.com/${e}`,status:f,queuedAt:m(d?.queuedAt??c.queued_at)??new Date().toISOString(),queuePosition:j,progress:d?.progress??null,errorMessage:d?.errorMessage??c.error_message??null,queueHint:g?function(a,b,c,d,e){switch(a){case"processing":if("retrying"===b)return d?`Discofork is retrying this repository after a transient failure. Retry ${e} is scheduled for ${d}.`:`Discofork is retrying this repository after a transient failure. Retry ${e} is pending.`;return"This repository is currently being analyzed by Discofork.";case"failed":return"terminal"===b?"The latest analysis exhausted the retry budget and now needs a manual requeue.":"The latest analysis failed. Requeue it to try another run.";case"queued":return c?`This repository is queued for Discofork analysis. Current queue position: ${c}.`:"This repository has been queued for Discofork analysis.";default:return"No cached data exists yet. This repository has been queued for Discofork analysis."}}(f,i,j,k,l):function(a,b,c,d){switch(a){case"processing":return"Discofork has a stored processing state for this repository, but Redis queueing is unavailable so live worker progress may be stale.";case"failed":if("retrying"===b)return`Discofork recorded a pending retry for this repository, but Redis queueing is unavailable so retry ${d} cannot be tracked live right now.`;return"terminal"===b?"The latest analysis exhausted the retry budget. Redis queueing is unavailable, so a new run cannot be requested right now.":"The latest analysis failed. Redis queueing is unavailable, so a new run cannot be requested right now.";default:return"Discofork has a stored queued state for this repository, but Redis queueing is unavailable so live queue progress is unavailable right now."}}(f,i,0,l),liveStatusEnabled:g,retryCount:l,retryState:i,nextRetryAt:k,lastFailedAt:d?.lastFailedAt??c.last_failed_at}}(a,b,d,f)}let w=(0,e.cache)(async(a,b)=>{l(a,b);let c=`${a}/${b}`;if((0,f.W)()){let d=await r(a,b);return d||((await p(c),(0,h.qK)())?q(a,b,"No cached data exists yet. Open the main repository page to queue this repository for Discofork analysis."):q(a,b,v))}let d=u.get(c);return d||q(a,b,"No cached analysis was found. Configure DATABASE_URL and REDIS_URL to enable real queueing and cached repo views.")}),x=(0,e.cache)(async(a,b)=>{l(a,b);let c=`${a}/${b}`;if((0,f.W)()){let d=await r(a,b);if(d)return d;if(await p(c),!(0,h.qK)())return q(a,b,v);let e=await (0,h.CC)(c);return await (0,i.f9)(a,b,e),await r(a,b)??q(a,b,"This repository has been queued for Discofork analysis.",{liveStatusEnabled:!0})}return w(a,b)});d()}catch(a){d(a)}})},62274:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{j:()=>k});var e=c(66235),f=c(30637),g=c(2397),h=a([f]);async function i(a){if(!(0,g.qK)())return null;let b=await (0,g.nr)();try{let c=await b.get(`${e.qR}${a}`);if(!c)return null;return JSON.parse(c)}catch{return null}}async function j(a){if(!(0,g.qK)())return{queuePosition:null,processing:!1};try{return await (0,g.fs)(a)}catch{return{queuePosition:null,processing:!1}}}async function k(a){let b=(await (0,f.P)(`select
      status,
      error_message,
      queued_at,
      processing_started_at,
      cached_at,
      retry_count,
      retry_state,
      next_retry_at,
      last_failed_at
    from repo_reports
    where full_name = $1`,[a]))[0];if(!b)return null;let[c,d]=await Promise.all([j(a),i(a)]),e="ready"===b.status?"ready":d?.status==="processing"||c.processing||"processing"===b.status?"processing":b.status;return{status:e,queuePosition:"queued"===e?c.queuePosition:null,progress:d&&(d.phase||d.detail||null!==d.current||null!==d.total)?{phase:d.phase,detail:d.detail,current:d.current,total:d.total,updatedAt:d.updatedAt}:null,errorMessage:b.error_message,queuedAt:b.queued_at,processingStartedAt:b.processing_started_at,cachedAt:b.cached_at,retryCount:b.retry_count??0,retryState:b.retry_state??"none",nextRetryAt:b.next_retry_at,lastFailedAt:b.last_failed_at}}f=(h.then?(await h)():h)[0],d()}catch(a){d(a)}})},66235:(a,b,c)=>{c.d(b,{$D:()=>d,Sq:()=>g,bU:()=>i,eH:()=>j,iZ:()=>f,qR:()=>h,rd:()=>e});let d="discofork:repo-jobs",e="discofork:repo-jobs:processing",f="discofork:repo-job:",g=1800,h="discofork:repo-progress:",i="discofork:github-api:pause-until",j="discofork:github-rate-limit:snapshot:v1"},74152:(a,b,c)=>{c.d(b,{OE:()=>j,cb:()=>i});let d=[".well-known"],e=["admin/.env","wp-admin/admin-ajax.php"],f=new Set(d),g=new Set(e);function h(a){return a.map(a=>`'${a.replaceAll("'","''")}'`).join(", ")}let i=`owner like '.%' or position('%' in owner) > 0 or position('%' in repo) > 0 or position('/' in owner) > 0 or position('/' in repo) > 0 or position(chr(92) in owner) > 0 or position(chr(92) in repo) > 0 or position('..' in owner) > 0 or position('..' in repo) > 0 or lower(owner) in (${h(d)}) or lower(owner || '/' || repo) in (${h(e)})`;function j(a,b){let c=a.toLowerCase(),d=b.toLowerCase(),e=`${c}/${d}`;return a.startsWith(".")?"Owner segment starts with a hidden-path prefix.":a.includes("%")||b.includes("%")?"Owner or repository name still contains URL-encoded path characters.":a.includes("/")||b.includes("/")||a.includes("\\")||b.includes("\\")?"Owner or repository name contains path separators.":a.includes("..")||b.includes("..")?"Owner or repository name contains path traversal markers.":f.has(c)?"Owner segment matches a known web probe path.":g.has(e)?"Owner and repository pair matches a known web probe route.":null}}};