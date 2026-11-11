import{t as v}from"./preload-helper-BdDHxvum.js";import{r as J}from"./constants-RJ4jNr01.js";import{n as V,t as R}from"./async-errors-C4kfchr9.js";import{a as j,o as K}from"./js-yaml-onWw6tsF.js";var Q=R(_,{source:import.meta.url,operation:"closeDebugPanel"}),X="xiaobaix_debug_panel_pos_v2",z="xiaobaix_debug_panel_minipos_v2",p=!1,b=!1,r=null,o=null,g=null,s=null,C=null,k=0,L=!1,H=!1,I=null,D=!1,h=null,x=null,w=null,P=0,T=0,O=0,d=[],y=[],S=50,Z=500,f=(e,t,n)=>Math.max(t,Math.min(n,e)),E=()=>window.innerWidth<=768,ee=e=>(e||[]).filter(t=>t?.level==="error").length,te=e=>(e||[]).reduce((t,n)=>Math.max(t,Number(n?.id)||0),0);function $(e){try{const t=localStorage.getItem(e);return t?JSON.parse(t):null}catch{return null}}function q(e,t){try{localStorage.setItem(e,JSON.stringify(t))}catch(n){console.warn({source:import.meta.url,operation:"writeJSON"},n)}}function ne(){try{return{domCount:document.querySelectorAll("*").length,messageCount:document.querySelectorAll(".mes").length,imageCount:document.querySelectorAll("img").length}}catch{return{domCount:0,messageCount:0,imageCount:0}}}function re(){h||(h=window.fetch,window.fetch=async function(e,t){const n=typeof e=="string"?e:e?.url||"",a=t?.method||"GET",i=performance.now(),l=Date.now();try{const c=await h.apply(this,arguments),m=performance.now()-i;return n.includes("/api/")&&m>=Z&&(d.push({url:n,method:a,duration:Math.round(m),timestamp:l,status:c.status}),d.length>S&&d.shift()),c}catch(c){const m=performance.now()-i;throw d.push({url:n,method:a,duration:Math.round(m),timestamp:l,status:"error"}),d.length>S&&d.shift(),c}})}function oe(){h&&(window.fetch=h,h=null)}function ae(){if(!x)try{if(typeof PerformanceObserver>"u")return;x=new PerformanceObserver(e=>{for(const t of e.getEntries())if(t.duration>=200){let n="主页面";try{const a=t.attribution?.[0];if(a)if(a.containerType==="iframe"){if(n="iframe",a.containerSrc){const i=new URL(a.containerSrc,location.href);n+=`: ${i.pathname.split("/").pop()||i.pathname}`}}else a.containerName&&(n=a.containerName)}catch(a){console.warn({source:import.meta.url,operation:"startLongTaskObserver"},a)}y.push({duration:Math.round(t.duration),timestamp:Date.now(),source:n}),y.length>S&&y.shift()}}),x.observe({entryTypes:["longtask"]})}catch(e){console.warn({source:import.meta.url,operation:"startLongTaskObserver"},e)}}function ie(){if(x){try{x.disconnect()}catch(e){console.warn({source:import.meta.url,operation:"stopLongTaskObserver"},e)}x=null}}function se(){if(w)return;P=performance.now(),T=0;const e=t=>{T++,t-P>=1e3&&(O=T,T=0,P=t),w=requestAnimationFrame(e)};w=requestAnimationFrame(e)}function le(){w&&(cancelAnimationFrame(w),w=null),O=0}function ce(){if(typeof performance>"u"||!performance.memory)return null;const e=performance.memory;return{used:e.usedJSHeapSize,total:e.totalJSHeapSize,limit:e.jsHeapSizeLimit}}function ue(){D||(D=!0,re(),ae(),se())}function de(){D&&(D=!1,oe(),ie(),le(),d.length=0,y.length=0)}function pe(){if(document.getElementById("xiaobaix-debug-style"))return;const e=document.createElement("style");e.id="xiaobaix-debug-style",e.textContent=`
#xiaobaix-debug-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
}
#xiaobaix-debug-btn .dbg-light {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #555;
    flex-shrink: 0;
    transition: background 0.2s, box-shadow 0.2s;
}
#xiaobaix-debug-btn .dbg-light.on {
    background: #4ade80;
    box-shadow: 0 0 6px #4ade80;
}
#xiaobaix-debug-mini {
    position: fixed;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(28, 28, 32, 0.96);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: rgba(255,255,255,0.9);
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    touch-action: none;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    transition: box-shadow 0.2s;
}
#xiaobaix-debug-mini:hover {
    box-shadow: 0 6px 18px rgba(0,0,0,0.45);
}
#xiaobaix-debug-mini .badge {
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(255,80,80,0.18);
    border: 1px solid rgba(255,80,80,0.35);
    color: #fca5a5;
    font-size: 10px;
}
#xiaobaix-debug-mini .badge.hidden { display: none; }
#xiaobaix-debug-mini.flash {
    animation: xbdbg-flash 0.35s ease-in-out 2;
}
@keyframes xbdbg-flash {
    0%,100% { box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
    50% { box-shadow: 0 0 0 4px rgba(255,80,80,0.4); }
}
#xiaobaix-debug-panel {
    position: fixed;
    z-index: 10001;
    background: rgba(22,22,26,0.97);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    box-shadow: 0 12px 36px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
@media (min-width: 769px) {
    #xiaobaix-debug-panel {
        resize: both;
        min-width: 320px;
        min-height: 260px;
    }
}
@media (max-width: 768px) {
    #xiaobaix-debug-panel {
        left: 0 !important;
        right: 0 !important;
        top: 0 !important;
        width: 100% !important;
        border-radius: 0;
        resize: none;
    }
}
#xiaobaix-debug-titlebar {
    user-select: none;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: rgba(30,30,34,0.98);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
}
@media (min-width: 769px) {
    #xiaobaix-debug-titlebar { cursor: move; }
}
#xiaobaix-debug-titlebar .left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255,255,255,0.88);
}
#xiaobaix-debug-titlebar .right {
    display: flex;
    align-items: center;
    gap: 6px;
}
.xbdbg-btn {
    width: 28px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.85);
    cursor: pointer;
    font-size: 12px;
    transition: background 0.15s;
}
.xbdbg-btn:hover { background: rgba(255,255,255,0.12); }
#xiaobaix-debug-frame {
    flex: 1;
    border: 0;
    width: 100%;
    background: transparent;
}
`,document.head.appendChild(e)}function N(){const e=document.getElementById("nonQRFormItems");return e?e.getBoundingClientRect():{top:window.innerHeight-60,right:window.innerWidth,left:0,width:window.innerWidth}}function fe(){const e=N(),t=90,n=32,a=8;return{left:e.right-t-a,top:e.top-n-a}}function B(){if(!o)return;const e=$(z),t=fe(),n=e||t,a=o.offsetWidth||90,i=o.offsetHeight||32;o.style.left=`${f(n.left,0,window.innerWidth-a)}px`,o.style.top=`${f(n.top,0,window.innerHeight-i)}px`}function ge(){if(!o)return;const e=o.getBoundingClientRect();q(z,{left:Math.round(e.left),top:Math.round(e.top)})}function Y(){if(!r)return;if(E()){const m=N();r.style.left="0",r.style.top="0",r.style.width="100%",r.style.height=`${m.top}px`;return}const e=$(X),t=480,n=400,a=e?.width>=320?e.width:t,i=e?.height>=260?e.height:n,l=e?.left!=null?f(e.left,0,window.innerWidth-a):20,c=e?.top!=null?f(e.top,0,window.innerHeight-i):80;r.style.left=`${l}px`,r.style.top=`${c}px`,r.style.width=`${a}px`,r.style.height=`${i}px`}function M(){if(!r||E())return;const e=r.getBoundingClientRect();q(X,{left:Math.round(e.left),top:Math.round(e.top),width:Math.round(e.width),height:Math.round(e.height)})}async function be(){const{xbLog:e,CacheRegistry:t}=await v(async()=>{const{xbLog:i,CacheRegistry:l}=await import("./debug-core-DEeDonuq.js").then(c=>c.n);return{xbLog:i,CacheRegistry:l}},[],import.meta.url),{EventCenter:n}=await v(async()=>{const{EventCenter:i}=await import("./event-manager-CDcD0tzi.js").then(l=>l.r);return{EventCenter:i}},[],import.meta.url),a=ne();return{logs:e.getAll(),events:n.getEventHistory?.()||[],eventStatsDetail:n.statsDetail?.()||{},caches:t.getStats(),performance:{requests:d.slice(),longTasks:y.slice(),fps:O,memory:ce(),domCount:a.domCount,messageCount:a.messageCount,imageCount:a.imageCount}}}function A(e){try{K(g,{...e},"LittleWhiteBox-DebugHost")}catch(t){console.warn({source:import.meta.url,operation:"postToFrame"},t)}}async function u(){if(!L)return;const e=await be();A({type:"XB_DEBUG_DATA",payload:e}),xe(e.logs)}async function me(e){const{xbLog:t,CacheRegistry:n}=await v(async()=>{const{xbLog:i,CacheRegistry:l}=await import("./debug-core-DEeDonuq.js").then(c=>c.n);return{xbLog:i,CacheRegistry:l}},[],import.meta.url),{EventCenter:a}=await v(async()=>{const{EventCenter:i}=await import("./event-manager-CDcD0tzi.js").then(l=>l.r);return{EventCenter:i}},[],import.meta.url);switch(e?.action){case"refresh":await u();break;case"clearLogs":t.clear(),await u();break;case"clearEvents":a.clearHistory?.(),await u();break;case"clearCache":e.moduleId&&n.clear(e.moduleId),await u();break;case"clearAllCaches":n.clearAll(),await u();break;case"clearRequests":d.length=0,await u();break;case"clearTasks":y.length=0,await u();break;case"cacheDetail":A({type:"XB_DEBUG_CACHE_DETAIL",payload:{moduleId:e.moduleId,detail:n.getDetail(e.moduleId)}});break;case"exportLogs":A({type:"XB_DEBUG_EXPORT",payload:{text:t.export()}});break}}function he(){H||(H=!0,window.addEventListener("message",R(async e=>{if(!j(e,g,"LittleWhiteBox-DebugFrame"))return;const t=e?.data;t.type==="FRAME_READY"?(L=!0,await u()):t.type==="XB_DEBUG_ACTION"?await me(t):t.type==="CLOSE_PANEL"&&V(_(),{source:import.meta.url,operation:"bindMessageListener"})},{source:import.meta.url,operation:"callback"})))}function xe(e){if(!o)return;const t=o.querySelector(".badge");if(!t)return;const n=ee(e);t.classList.toggle("hidden",n<=0),t.textContent=n>0?String(n):"";const a=te(e);a>k&&!b&&(o.classList.remove("flash"),o.offsetWidth,o.classList.add("flash")),k=a}function U(){const e=document.querySelector("#xiaobaix-debug-btn .dbg-light");e&&e.classList.toggle("on",p)}function we(e){if(!(e.button!==void 0&&e.button!==0)){s={startX:e.clientX,startY:e.clientY,startLeft:o.getBoundingClientRect().left,startTop:o.getBoundingClientRect().top,pointerId:e.pointerId,moved:!1};try{e.currentTarget.setPointerCapture(e.pointerId)}catch(t){console.warn({source:import.meta.url,operation:"onMiniDown"},t)}e.preventDefault()}}function ye(e){if(!s||s.pointerId!==e.pointerId)return;const t=e.clientX-s.startX,n=e.clientY-s.startY;(Math.abs(t)>3||Math.abs(n)>3)&&(s.moved=!0);const a=o.offsetWidth||90,i=o.offsetHeight||32;o.style.left=`${f(s.startLeft+t,0,window.innerWidth-a)}px`,o.style.top=`${f(s.startTop+n,0,window.innerHeight-i)}px`,e.preventDefault()}function F(e){if(!s||s.pointerId!==e.pointerId)return;const t=s.moved;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(n){console.warn({source:import.meta.url,operation:"onMiniUp"},n)}s=null,ge(),t||Ie()}function ve(e){if(!E()&&!(e.button!==void 0&&e.button!==0)&&!e.target?.closest?.(".xbdbg-btn")){s={startX:e.clientX,startY:e.clientY,startLeft:r.getBoundingClientRect().left,startTop:r.getBoundingClientRect().top,pointerId:e.pointerId};try{e.currentTarget.setPointerCapture(e.pointerId)}catch(t){console.warn({source:import.meta.url,operation:"onTitleDown"},t)}e.preventDefault()}}function Ee(e){if(!s||E()||s.pointerId!==e.pointerId)return;const t=e.clientX-s.startX,n=e.clientY-s.startY,a=r.offsetWidth,i=r.offsetHeight;r.style.left=`${f(s.startLeft+t,0,window.innerWidth-a)}px`,r.style.top=`${f(s.startTop+n,0,window.innerHeight-i)}px`,e.preventDefault()}function W(e){if(!(!s||E()||s.pointerId!==e.pointerId)){try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(t){console.warn({source:import.meta.url,operation:"onTitleUp"},t)}s=null,M()}}function Le(){G(),C=setInterval(R(async()=>{if(p)try{await u()}catch(e){console.warn({source:import.meta.url,operation:"startPoll"},e)}},{source:import.meta.url,operation:"callback"}),1500)}function G(){C&&(clearInterval(C),C=null)}function _e(){p&&(b?Y():B())}function Te(){o||(o=document.createElement("div"),o.id="xiaobaix-debug-mini",o.innerHTML='<span>监控</span><span class="badge hidden"></span>',document.body.appendChild(o),B(),o.addEventListener("pointerdown",we,{passive:!1}),o.addEventListener("pointermove",ye,{passive:!1}),o.addEventListener("pointerup",F,{passive:!1}),o.addEventListener("pointercancel",F,{passive:!1}))}function Ce(){o?.remove(),o=null}function De(){if(r)return;r=document.createElement("div"),r.id="xiaobaix-debug-panel";const e=document.createElement("div");e.id="xiaobaix-debug-titlebar",e.innerHTML=`
        <div class="left"><span>小白X 监控台</span></div>
        <div class="right">
            <button class="xbdbg-btn" id="xbdbg-min" title="最小化" type="button">—</button>
            <button class="xbdbg-btn" id="xbdbg-close" title="关闭" type="button">×</button>
        </div>
    `,g=document.createElement("iframe"),g.id="xiaobaix-debug-frame",g.src=`${J}/modules/debug-panel/debug-panel.html`,r.appendChild(e),r.appendChild(g),document.body.appendChild(r),Y(),e.addEventListener("pointerdown",ve,{passive:!1}),e.addEventListener("pointermove",Ee,{passive:!1}),e.addEventListener("pointerup",W,{passive:!1}),e.addEventListener("pointercancel",W,{passive:!1}),r.querySelector("#xbdbg-min")?.addEventListener("click",Pe),r.querySelector("#xbdbg-close")?.addEventListener("click",Q),E()||(r.addEventListener("mouseup",M),r.addEventListener("mouseleave",M)),L=!1}function Me(){r?.remove(),r=null,g=null,L=!1}function Ie(){b||(b=!0,o&&(o.style.display="none"),r?r.style.display="":De())}function Pe(){b&&(b=!1,M(),r&&(r.style.display="none"),o&&(o.style.display="",B()))}async function ke(){if(p)return;p=!0,pe(),he();const{enableDebugMode:e}=await v(async()=>{const{enableDebugMode:t}=await import("./debug-core-DEeDonuq.js").then(n=>n.n);return{enableDebugMode:t}},[],import.meta.url);e(),ue(),Te(),Le(),U(),I||(I=_e,window.addEventListener("resize",I));try{window.registerModuleCleanup?.("debugPanel",_)}catch(t){console.warn({source:import.meta.url,operation:"openDebugPanel"},t)}}async function _(){if(p){p=!1,b=!1,G(),de(),L=!1,k=0;try{const{disableDebugMode:e}=await v(async()=>{const{disableDebugMode:t}=await import("./debug-core-DEeDonuq.js").then(n=>n.n);return{disableDebugMode:t}},[],import.meta.url);e()}catch(e){console.warn({source:import.meta.url,operation:"closeDebugPanel"},e)}Me(),Ce(),U()}}async function Se(){p?await _():await ke()}typeof window<"u"&&(window.xbDebugPanelToggle=Se,window.xbDebugPanelClose=_);export{_ as closeDebugPanelExplicit,ke as openDebugPanelExplicit,Se as toggleDebugPanel};
