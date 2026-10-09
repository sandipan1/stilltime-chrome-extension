const COLORS = ["#8eaaa3", "#aaa1d1", "#e3bca8", "#9bb8d2", "#d7c78f", "#bbced0", "#c5b5a9", "#a4b996", "#c4a8b4"];
const state = { range: "today", data: { days: {} }, current: null, tracking: false, paused: false, selected: null, expanded: false };
const $ = id => document.getElementById(id);

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function daysForRange(range = state.range) {
  const today = new Date(); today.setHours(0,0,0,0);
  if (range === "all") return Object.keys(state.data.days).sort();
  const count = range === "today" ? 1 : Number(range);
  return Array.from({length: count}, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (count - 1 - i)); return dayKey(d); });
}
function aggregate(range = state.range) {
  const domains = {};
  for (const key of daysForRange(range)) {
    for (const [domain, record] of Object.entries(state.data.days[key] || {})) {
      domains[domain] ||= { ms: 0, visits: 0, days: {} };
      domains[domain].ms += record.ms || 0;
      domains[domain].visits += record.visits || 0;
      domains[domain].days[key] = record.ms || 0;
    }
  }
  return Object.entries(domains).map(([domain, values]) => ({domain, ...values})).sort((a,b) => b.ms - a.ms);
}
function duration(ms, compact = false) {
  const minutes = Math.round(Math.max(0,ms) / 60000);
  if (ms > 0 && minutes === 0) return `0<span>h</span> &lt;1<span>m</span>`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (compact) return hours ? `${hours}h ${String(rest).padStart(2,"0")}m` : `${rest}m`;
  return `${hours}<span>h</span> ${String(rest).padStart(2,"0")}<span>m</span>`;
}
function shortDuration(ms) {
  const safeMs = Math.max(0,ms);
  const minutes = Math.round(safeMs/60000);
  if (safeMs > 0 && minutes === 0) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes/60), rest = minutes%60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
function niceRange() { return ({today:"TODAY", "7":"LAST 7 DAYS", "30":"LAST 30 DAYS", all:"ALL TIME"})[state.range]; }
function render() {
  const entries = aggregate();
  const total = entries.reduce((sum, item) => sum + item.ms, 0);
  const visits = entries.reduce((sum, item) => sum + item.visits, 0);
  $("date-label").textContent = state.range === "today" ? new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(new Date()).toUpperCase() : "YOUR BROWSING, GENTLY";
  $("greeting").textContent = state.range === "today" ? "A clearer day." : state.range === "all" ? "Your bigger picture." : "Your time, in view.";
  $("tracking-label").textContent = state.paused ? "Paused" : "Tracking";
  const trackingToggle = $("tracking-toggle");
  if (trackingToggle) {
    trackingToggle.classList.toggle("paused", state.paused);
    trackingToggle.setAttribute("aria-pressed", String(state.paused));
    trackingToggle.setAttribute("aria-label", state.paused ? "Resume tracking" : "Pause tracking");
    trackingToggle.title = state.paused ? "Resume tracking" : "Pause tracking";
  }
  document.querySelector(".live-dot")?.classList.toggle("paused", state.paused);
  $("total-time").innerHTML = duration(total);
  $("site-count").textContent = `Across ${entries.length} ${entries.length === 1 ? "website" : "websites"}`;
  const visitCount = $("visit-count");
  if (visitCount) visitCount.textContent = visits.toLocaleString();
  $("chart-caption").textContent = niceRange();
  $("chart-total").textContent = total ? shortDuration(total) : "0m";
  $("empty-state").classList.toggle("hidden", entries.length > 0);
  $("site-list").classList.toggle("hidden", entries.length === 0);
  renderChart(entries,total);
  renderList(entries);
  if (state.selected && entries.some(item => item.domain === state.selected)) renderDetail(entries.find(item => item.domain === state.selected));
  else { state.selected = null; $("detail-card").classList.add("hidden"); }
}
function point(angle, radius) { return [110 + radius * Math.cos(angle), 110 + radius * Math.sin(angle)]; }
function ringPath(start, end) {
  const large = end-start > Math.PI ? 1 : 0;
  const a = point(start,91), b = point(end,91), c = point(end,64), d = point(start,64);
  return `M ${a[0]} ${a[1]} A 91 91 0 ${large} 1 ${b[0]} ${b[1]} L ${c[0]} ${c[1]} A 64 64 0 ${large} 0 ${d[0]} ${d[1]} Z`;
}
function renderChart(entries,total) {
  const svg = $("donut-chart"); svg.replaceChildren();
  if (!total) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
    circle.setAttribute("cx",110); circle.setAttribute("cy",110); circle.setAttribute("r",77); circle.setAttribute("fill","none"); circle.setAttribute("stroke","#e5e9e4"); circle.setAttribute("stroke-width",27); svg.append(circle); return;
  }
  if (entries.length === 1) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
    circle.setAttribute("cx",110); circle.setAttribute("cy",110); circle.setAttribute("r",77); circle.setAttribute("fill","none");
    circle.setAttribute("stroke",COLORS[0]); circle.setAttribute("stroke-width",27); circle.classList.add("slice");
    circle.setAttribute("tabindex","0"); circle.setAttribute("role","button"); circle.setAttribute("aria-label",`${entries[0].domain}, ${shortDuration(entries[0].ms)}, ${entries[0].visits} visits`);
    circle.addEventListener("click",()=>selectSite(entries[0].domain));
    circle.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectSite(entries[0].domain);}});
    if(state.selected===entries[0].domain)circle.classList.add("selected");
    svg.append(circle); return;
  }
  let angle = -Math.PI/2;
  entries.forEach((item,index) => {
    const sweep = item.ms/total*Math.PI*2;
    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", ringPath(angle,angle+sweep)); path.setAttribute("fill",COLORS[index%COLORS.length]); path.classList.add("slice");
    if (state.selected === item.domain) path.classList.add("selected");
    path.setAttribute("tabindex","0"); path.setAttribute("role","button"); path.setAttribute("aria-label",`${item.domain}, ${shortDuration(item.ms)}, ${item.visits} visits`);
    path.addEventListener("click",() => selectSite(item.domain)); path.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectSite(item.domain);}});
    svg.append(path); angle += sweep;
  });
}
function faviconNode(domain, cls) {
  const node=document.createElement("span"); node.className=cls; node.textContent=(domain.replace(/^www\./,"")[0]||"•").toUpperCase(); node.setAttribute("aria-hidden","true"); return node;
}
function renderList(entries) {
  const list=$("site-list"); list.replaceChildren();
  const visible=state.expanded?entries:entries.slice(0,7);
  visible.forEach((item,index)=>{
    const row=document.createElement("button"); row.className=`site-row${state.selected===item.domain?" selected":""}`; row.type="button"; row.setAttribute("aria-label",`Show ${item.domain} details`);
    const swatch=document.createElement("span"); swatch.className="site-swatch"; swatch.style.background=COLORS[index%COLORS.length];
    row.append(swatch,faviconNode(item.domain,"site-favicon"));
    const name=document.createElement("span"); name.className="site-name"; name.textContent=item.domain;
    const meta=document.createElement("span"); meta.className="site-meta"; meta.textContent=`${item.visits} ${item.visits===1?"visit":"visits"}`;
    const time=document.createElement("span"); time.className="site-time"; time.textContent=shortDuration(item.ms);
    row.append(name,meta,time); row.addEventListener("click",()=>selectSite(item.domain)); list.append(row);
  });
  if(entries.length>7){const more=document.createElement("button");more.className="more-button";more.textContent=state.expanded?"Show less":`Show all ${entries.length} sites`;more.addEventListener("click",()=>{state.expanded=!state.expanded;renderList(entries);});list.append(more);}
}
function selectSite(domain) { state.selected=state.selected===domain?null:domain; render(); if(state.selected) $("detail-card").scrollIntoView({behavior:"smooth",block:"nearest"}); }
function renderDetail(item) {
  $("detail-card").classList.remove("hidden"); $("detail-domain").textContent=item.domain;
  const fav=$("detail-favicon"); fav.textContent=(item.domain[0]||"•").toUpperCase();
  $("detail-time").textContent=shortDuration(item.ms); $("detail-visits").textContent=item.visits.toLocaleString();
  $("detail-average").textContent=shortDuration(item.visits?item.ms/item.visits:0);
  const bars=$("daily-bars"); bars.replaceChildren();
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));return d;});
  const values=days.map(d=>item.days[dayKey(d)]||0), max=Math.max(...values,60000);
  days.forEach((date,i)=>{
    const col=document.createElement("div");col.className="bar-day";col.title=`${date.toLocaleDateString(undefined,{weekday:"long"})}: ${shortDuration(values[i])}`;
    const val=document.createElement("span");val.className="bar-value";val.textContent=values[i]?shortDuration(values[i]):"";
    const rail=document.createElement("span");rail.className="bar-rail";const fill=document.createElement("span");fill.className="bar-fill";fill.style.height=values[i]?`${Math.max(7,values[i]/max*100)}%`:"2px";rail.append(fill);
    const label=document.createElement("span");label.className="bar-label";label.textContent=date.toLocaleDateString(undefined,{weekday:"short"}).slice(0,1);
    col.append(val,rail,label);bars.append(col);
  });
}
function csvEscape(value){return `"${String(value).replaceAll('"','""')}"`;}
function exportCsv(){
  const rows=[["date","website","time_minutes","visits"]];
  for(const date of Object.keys(state.data.days).sort())for(const [domain,record] of Object.entries(state.data.days[date]))rows.push([date,domain,Math.round((record.ms||0)/60000),record.visits||0]);
  const blob=new Blob([rows.map(row=>row.map(csvEscape).join(",")).join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`stilltime-${dayKey(new Date())}.csv`;a.click();URL.revokeObjectURL(url);toast("Your CSV is ready");
}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800);}
async function refresh(){const result=await chrome.runtime.sendMessage({type:"getStats"});if(!result?.data){toast("Reload Stilltime to reconnect its tracker");return;}state.data=result.data;state.current=result.current;state.tracking=Boolean(result.tracking);state.paused=Boolean(result.paused);render();}
document.querySelectorAll(".range-switch button").forEach(button=>button.addEventListener("click",()=>{state.range=button.dataset.range;state.expanded=false;document.querySelectorAll(".range-switch button").forEach(item=>item.classList.toggle("active",item===button));render();}));
$("tracking-toggle").addEventListener("click",async()=>{const result=await chrome.runtime.sendMessage({type:"setPaused",paused:!state.paused});if(typeof result?.paused!=="boolean"){toast("Reload Stilltime to enable pause and resume");return;}state.paused=result.paused;await refresh();toast(state.paused?"Tracking paused":"Tracking resumed");});
$("close-detail").addEventListener("click",()=>{state.selected=null;render();});
$("export-button").addEventListener("click",exportCsv);
$("clear-button").addEventListener("click",async()=>{if(!confirm("Clear all Stilltime browsing history from this device?"))return;await chrome.runtime.sendMessage({type:"clearStats"});state.selected=null;await refresh();toast("Your local history was cleared");});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes.stilltimeData){state.data=changes.stilltimeData.newValue||{days:{}};render();}});
refresh();
setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},15000);
