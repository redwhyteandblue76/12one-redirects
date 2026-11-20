'use strict';
// Public frontend. Compatible with both the original JSONP API and v2 per-slug lookups.
const API_URL = 'https://script.google.com/macros/s/AKfycbx2XLJeq_BDcPy_l6IoXTtFqf8fLs1kKO77B_D9MbE6hjymfuCb5nMZbgpc2x56_Tz_/exec';
const heading = document.getElementById('heading');
const message = document.getElementById('message');
const requestedUrl = document.getElementById('requested-url');
function show(title, description) {
  heading.textContent = title;
  message.textContent = description;
  requestedUrl.hidden = true;
  requestedUrl.textContent = '';
  const circle=document.querySelector('.circle'); if(circle) circle.textContent='↗';
}
function showUnavailable(description = 'Check for typos or contact the person who provided this link.') {
  show('Link unavailable', description);
  requestedUrl.textContent = 'You entered: ' + location.href;
  requestedUrl.hidden = false;
}
function slugFromPath() {
  let path;try{path=decodeURIComponent(location.pathname);}catch{return null;}
  const slug=path.replace(/^\/+|\/+$/g,'').toLowerCase();
  if(!slug||slug==='index.html'||slug==='404.html')return '';
  return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug)?slug:null;
}
function fetchJsonp(slug) {
  return new Promise((resolve,reject)=>{
    const cb='__r12one_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');let settled=false;
    const clean=()=>{clearTimeout(timer);script.remove();delete window[cb];};
    const finish=(err,result)=>{if(settled)return;settled=true;clean();err?reject(err):resolve(result);};
    window[cb]=result=>finish(null,result);
    script.onerror=()=>finish(Error('Could not load redirect data'));
    const timer=setTimeout(()=>finish(Error('Redirect lookup timed out')),12000);
    const url=new URL(API_URL);url.searchParams.set('callback',cb);
    url.searchParams.set('slug',slug);url.searchParams.set('_',Date.now());
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k=>{
      const v=new URLSearchParams(location.search).get(k);if(v)url.searchParams.set(k,v.slice(0,120));
    });
    script.src=url.href;document.head.appendChild(script);
  });
}
function destinationUrl(target){
  const url=new URL(target);if(!['https:','http:'].includes(url.protocol))throw Error('Unsafe URL');
  return url.href;
}
function countdown(destination,config){
  let secs=config&&config.enabled?Math.max(0,Math.min(30,Number(config.seconds)||0)):0;
  if(!secs){location.replace(destination);return;}
  show(String(config.heading||'Redirecting…'),String(config.message||'Taking you to your destination.'));
  const link=document.createElement('a');link.href=destination;link.textContent='Continue now';
  message.insertAdjacentElement('afterend',link);
  const interval=setInterval(()=>{secs--;if(secs<=0){clearInterval(interval);location.replace(destination);return;}
    message.textContent=String(config.message||'Taking you to your destination.')+' '+secs+'s';},1000);
}
(async()=>{
 const slug=slugFromPath();
 if(slug===''){show('Short links, made simple.','This domain hosts 12one short links. Open a complete link to continue.');return;}
 if(slug===null){showUnavailable();return;}
 try {
   const data=await fetchJsonp(slug);
   if(!data||typeof data!=='object')throw Error('Invalid API response');
   // Legacy endpoint contract, until the updated Apps Script deployment is published.
   if(data.redirects&&typeof data.redirects==='object'){
     const target=data.redirects[slug];
     if(typeof target==='string'){show('Redirecting…','Taking you to your destination.');location.replace(destinationUrl(target));return;}
     if(data.disabled&&Object.prototype.hasOwnProperty.call(data.disabled,slug)){
       showUnavailable('This link is currently disabled. Check with the person who provided it.');return;
     }
     showUnavailable();return;
   }
   switch(data.status){
     case 'redirect':countdown(destinationUrl(data.destination),data.countdown||{});return;
     case 'protected':{
       if(!data.gateUrl)throw Error('Password gateway unavailable');
       const gate=new URL(destinationUrl(data.gateUrl));
       const params=new URLSearchParams(location.search);
       ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k=>{if(params.has(k))gate.searchParams.set(k,params.get(k).slice(0,120));});
       show('Password required','Opening the protected link…');location.replace(gate.href);return;
     }
     case 'disabled':showUnavailable('This link is currently disabled. Check with the person who provided it.');return;
     case 'unavailable':showUnavailable(data.message || 'This link is currently unavailable. Check with the person who provided it.');return;
     case 'missing':showUnavailable();return;
     default:throw Error('Invalid redirect status');
   }
 }catch(error){console.error(error);showUnavailable('The destination could not be loaded. Try again shortly.');}
})();
