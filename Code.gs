// 12one Redirects v2: keep Redirects!A:E unchanged.
// Apps Script: deploy an "execute as me / anyone" PUBLIC web app and an
// "execute as user accessing" ADMIN web app; never expose admin deployment anonymously.
// Install Code.gs, Editor.html and Gate.html into the bound Apps Script project.
// Public script property PUBLIC_GATE_URL must point to the public /exec deployment.
const R12 = { SLUG:/^[a-z0-9][a-z0-9_-]{0,79}$/, SETTINGS:'RedirectSettings',
 STATS:'RedirectAnalytics', HISTORY:'RedirectHistory' };
function sheet_(name){return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);}
function table_(name,head){let s=sheet_(name)||SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);if(!s.getLastRow())s.appendRow(head);return s;}
function rows_(name){let s=sheet_(name);return s?s.getDataRange().getValues():[];}
function slug_(v){v=String(v||'').trim().toLowerCase();if(!R12.SLUG.test(v))throw Error('Invalid slug');return v;}
function url_(v,optional){v=String(v||'').trim();if(optional&&!v)return '';if(!/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(v))throw Error('Use a valid absolute HTTP(S) URL');return v;}
function date_(v){if(!v)return null;let d=Date.parse(v);if(!isFinite(d)||!/Z$|[+-]\d\d:\d\d$/.test(v))throw Error('Use ISO timestamps with timezone offset');return d;}
function requireAdmin_(){
 let email=String(Session.getActiveUser().getEmail()||'').toLowerCase();
 let ss=SpreadsheetApp.getActiveSpreadsheet(),owner=ss.getOwner()?String(ss.getOwner().getEmail()).toLowerCase():'';
 let allowed=String(PropertiesService.getScriptProperties().getProperty('R12_ADMIN_EMAILS')||'').toLowerCase().split(',').map(x=>x.trim());
 if(!email||(email!==owner&&!allowed.includes(email)))throw Error('Unauthorized editor. Use your authorized Google account.');
 return email;
}
function onOpen(){SpreadsheetApp.getUi().createMenu('12one Redirects').addItem('Advanced editor','showRedirectSidebar').addItem('Set up feature tabs','setupRedirects').addToUi();}
function setupRedirects(){requireAdmin_();let props=PropertiesService.getScriptProperties();if(!props.getProperty('R12_PEPPER'))props.setProperty('R12_PEPPER',Utilities.getUuid()+Utilities.getUuid());table_(R12.SETTINGS,['Slug','SettingsJSON','UpdatedAt']);table_(R12.STATS,['DayUTC','Slug','Requests','Redirects','PasswordFailures','SourceCountsJSON']);table_(R12.HISTORY,['At','Slug','Editor','Action','BeforeJSON','AfterJSON']);return 'Ready. Existing redirects unchanged.';}
function showRedirectSidebar(){requireAdmin_();SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Editor').setTitle('12one • Editor'));}
function links_(){
 let data=rows_('Redirects'),out={};if(!data.length)throw Error('Missing Redirects sheet');
 data.slice(1).forEach(r=>{let k=String(r[0]||'').trim().toLowerCase();if(!R12.SLUG.test(k)||Object.prototype.hasOwnProperty.call(out,k))return;
 out[k]={slug:k,url:String(r[1]||''),active:r[2]===true||String(r[2]).toLowerCase()==='true',notes:String(r[3]||''),disabledMessage:String(r[4]||'')};});
 return out;
}
function configs_(){let out={};rows_(R12.SETTINGS).slice(1).forEach(r=>{let k=String(r[0]||'').toLowerCase();if(!R12.SLUG.test(k))return;try{out[k]=JSON.parse(String(r[1]||'{}'));}catch(e){out[k]={invalid:true};}});return out;}
function validate_(s){
 if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Bad settings');
 let t=s.schedule||{},a=s.availability||{},c=s.countdown||{},u=s.utm||{};
 let out={version:1,schedule:{enabled:!!t.enabled,start:String(t.start||''),end:String(t.end||''),beforeUrl:url_(t.beforeUrl,true),duringUrl:url_(t.duringUrl,true),afterUrl:url_(t.afterUrl,true)},
 availability:{enabled:!!a.enabled,opensAt:String(a.opensAt||''),expiresAt:String(a.expiresAt||''),beforeMessage:String(a.beforeMessage||'').slice(0,500),afterMessage:String(a.afterMessage||'').slice(0,500)},
 password:{enabled:!!(s.password&&s.password.enabled)},analytics:{enabled:!!(s.analytics&&s.analytics.enabled)},
 countdown:{enabled:!!c.enabled,seconds:Math.min(30,Math.max(0,Number(c.seconds)||0)),heading:String(c.heading||'Redirecting…').slice(0,100),message:String(c.message||'Taking you to your destination.').slice(0,300)},
 utm:{enabled:!!u.enabled,incomingPolicy:u.incomingPolicy==='replace'?'replace':'preserve'}};
 if(out.schedule.enabled&&(date_(out.schedule.start)===null||date_(out.schedule.end)===null||date_(out.schedule.start)>=date_(out.schedule.end)))throw Error('Invalid schedule dates');
 if(out.availability.enabled&&out.availability.opensAt&&out.availability.expiresAt&&date_(out.availability.opensAt)>=date_(out.availability.expiresAt))throw Error('Invalid availability window');
 ['source','medium','campaign','content','term'].forEach(k=>out.utm[k]=String(u[k]||'').slice(0,120));
 return out;
}
function resolve_(link,s,clock,access){
 if(!link)return {status:'missing'};
 if(!link.active)return {status:'disabled',message:link.disabledMessage||'This link is currently disabled.'};
 if(s.invalid)return {status:'unavailable',message:'This link has an invalid configuration.'};
 let n=clock===undefined?Date.now():clock,a=s.availability||{},t=s.schedule||{};
 if(a.enabled&&a.opensAt&&n<date_(a.opensAt))return {status:'unavailable',message:a.beforeMessage||'This link is not yet open.'};
 if(a.enabled&&a.expiresAt&&n>=date_(a.expiresAt))return {status:'unavailable',message:a.afterMessage||'This link has expired.'};
 let dest=link.url;
 if(t.enabled){let start=date_(t.start),end=date_(t.end);if(start===null||end===null||start>=end)throw Error('Invalid schedule');dest=n<start?t.beforeUrl:n<end?t.duringUrl:t.afterUrl;}
 if(!dest)return {status:'unavailable',message:'No destination is configured for this time.'};
 url_(dest);
 if(s.password&&s.password.enabled&&!access)return {status:'protected'};
 return {status:'redirect',destination:dest,countdown:s.countdown||{},utm:s.utm||{}};
}
function queryUtm_(url,u,params){
 if(!u||!u.enabled)return url;
 let [base,frag]=url.split('#'), [path,existing]=base.split('?'), vals={};
 if(existing)existing.split('&').forEach(x=>{let i=x.indexOf('=');let k=i<0?x:x.slice(0,i);if(k)vals[decodeURIComponent(k)]=i<0?'':decodeURIComponent(x.slice(i+1).replace(/\+/g,' '));});
 ['source','medium','campaign','content','term'].forEach(k=>{let key='utm_'+k,configured=String(u[k]||''),incoming=String(params[key]||'');
 let value=u.incomingPolicy==='replace'?(configured||incoming):(incoming||configured);
 if(value)vals[key]=value.slice(0,120);});
 let args=Object.keys(vals).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(vals[k])).join('&');
 return path+(args?'?'+args:'')+(frag===undefined?'':'#'+frag);
}
function jsonp_(cb,value){if(!/^[$A-Z_a-z][$\w]*$/.test(cb))return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);return ContentService.createTextOutput(cb+'('+JSON.stringify(value)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);}
function doGet(e){
 let p=e&&e.parameter||{},view=String(p.view||''),links=links_(),conf=configs_();
 if(view==='admin'){requireAdmin_();return HtmlService.createHtmlOutputFromFile('Editor').setTitle('12one • Redirect Editor').addMetaTag('viewport','width=device-width,initial-scale=1');}
 if(view==='gate'){
   let slug=slug_(p.slug),result=resolve_(links[slug],conf[slug]||{});
   if(result.status!=='protected')return HtmlService.createHtmlOutput('<p>This protected link is unavailable.</p>');
   let template=HtmlService.createTemplateFromFile('Gate');template.linkSlug=slug;
   return template.evaluate().setTitle('12one • Password').addMetaTag('viewport','width=device-width,initial-scale=1');
 }
 let cb=String(p.callback||'');if(!cb)return ContentService.createTextOutput('12one API').setMimeType(ContentService.MimeType.TEXT);
 let slug=String(p.slug||'').trim().toLowerCase();
 if(slug){
   if(!R12.SLUG.test(slug))return jsonp_(cb,{status:'missing'});
   let result;try{result=resolve_(links[slug],conf[slug]||{});}catch(ex){result={status:'unavailable',message:'Link configuration unavailable.'};}
   if(result.status==='protected'){
      let gate=PropertiesService.getScriptProperties().getProperty('R12_PUBLIC_GATE_URL');
      if(!gate)result={status:'unavailable',message:'Password gateway has not been configured.'};
      else result.gateUrl=gate+'?view=gate&slug='+encodeURIComponent(slug);
   }
   if(result.status==='redirect'){
     result.destination=queryUtm_(result.destination,result.utm,p);
     if(conf[slug]&&conf[slug].analytics&&conf[slug].analytics.enabled)stats_(slug,'redirect',p.utm_source||'');
   }
   return jsonp_(cb,result);
 }
 // Backward-compatible bulk response: NEVER publish protected destinations.
 let redirects={},disabled={};Object.keys(links).forEach(k=>{
 let decision;try{decision=resolve_(links[k],conf[k]||{});}catch(ex){decision={status:'unavailable'};}
 if(decision.status==='redirect')redirects[k]=decision.destination;else disabled[k]=decision.message||'This link is currently unavailable.';
 });return jsonp_(cb,{redirects:redirects,disabled:disabled});
}
function stats_(slug,kind,source){
 try{let lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;try{
 let sh=table_(R12.STATS,['DayUTC','Slug','Requests','Redirects','PasswordFailures','SourceCountsJSON']);
 let day=Utilities.formatDate(new Date(),'UTC','yyyy-MM-dd'),data=sh.getDataRange().getValues(),row=0;
 for(let i=1;i<data.length;i++)if(String(data[i][0])===day&&String(data[i][1])===slug){row=i+1;break;}
 let r=row?data[row-1]:[day,slug,0,0,0,'{}'];r[2]=Number(r[2]||0)+1;
 if(kind==='redirect')r[3]=Number(r[3]||0)+1;if(kind==='fail')r[4]=Number(r[4]||0)+1;
 let sources={};try{sources=JSON.parse(r[5]||'{}');}catch(e){}
 if(/^[\w.-]{1,60}$/.test(String(source||''))){sources[source]=(sources[source]||0)+1;r[5]=JSON.stringify(sources);}
 if(row)sh.getRange(row,1,1,6).setValues([r]);else sh.appendRow(r);
 }finally{lock.releaseLock();}}catch(e){}
}
// The following functions are accessible through google.script.run.
// Authorization is checked INSIDE every administrative function.
function adminList(){requireAdmin_();return {links:links_(),settings:configs_()};}
function adminHistory(slug){requireAdmin_();slug=slug_(slug);return rows_(R12.HISTORY).slice(1).filter(r=>String(r[1])===slug).slice(-50).reverse();}
function adminStats(){requireAdmin_();return rows_(R12.STATS).slice(-500);}
function adminPreview(slug,iso,settings){requireAdmin_();let n=date_(iso);if(n===null)throw Error('Enter a preview date and time.');return resolve_(links_()[slug_(slug)],validate_(settings),n);}
function pwHash_(slug,password,salt){
 let pepper=PropertiesService.getScriptProperties().getProperty('R12_PEPPER');
 if(!pepper)throw Error('Password storage is not initialized. Run setupRedirects.');
 let b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,slug+':'+salt+':'+password+':'+pepper,Utilities.Charset.UTF_8);
 for(let i=0;i<2000;i++)b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b);
 return Utilities.base64Encode(b);
}
function equal_(a,b){let d=a.length^b.length;for(let i=0;i<Math.min(a.length,b.length);i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
function adminSave(slug,settings,url,active,notes,disabledMessage,password){
 let actor=requireAdmin_();slug=slug_(slug);
 let lock=LockService.getScriptLock();lock.waitLock(15000);
 try{
 let sh=sheet_('Redirects'),data=sh.getDataRange().getValues(),row=0;
 for(let i=1;i<data.length;i++)if(String(data[i][0]).trim().toLowerCase()===slug){row=i+1;break;}
 if(!row)throw Error('Create the slug in the original Redirects sheet first.');
 let next=validate_(settings),dest=url_(url,true),prior=links_()[slug],old=configs_()[slug]||{};
 if(active&&!dest&&!next.schedule.enabled)throw Error('Active redirect needs a destination.');
 let props=PropertiesService.getScriptProperties(),pw=String(password||'');
 if(next.password.enabled&&!pw&&!props.getProperty('R12_PW_'+slug))throw Error('Enter a password to enable protection.');
 if(pw&&(pw.length<12||pw.length>128))throw Error('Password must be 12–128 characters.');
 if(pw){let salt=Utilities.getUuid();props.setProperty('R12_PW_'+slug,salt+'.'+pwHash_(slug,pw,salt));}
 let config=table_(R12.SETTINGS,['Slug','SettingsJSON','UpdatedAt']),saved=config.getDataRange().getValues(),pos=0;
 for(let i=1;i<saved.length;i++)if(String(saved[i][0]).trim().toLowerCase()===slug){pos=i+1;break;}
 let val=[slug,JSON.stringify(next),new Date()];
 if(pos)config.getRange(pos,1,1,3).setValues([val]);else config.appendRow(val);
 sh.getRange(row,2,1,4).setValues([[dest,!!active,String(notes||''),String(disabledMessage||'').slice(0,1000)]]);
 table_(R12.HISTORY,['At','Slug','Editor','Action','BeforeJSON','AfterJSON']).appendRow([
 new Date(),slug,actor,'save',JSON.stringify({link:prior,settings:old}),
 JSON.stringify({link:{url:dest,active:!!active,notes:String(notes||''),disabledMessage:String(disabledMessage||'')},settings:next,passwordChanged:!!pw})]);
 return {ok:true};
 }finally{lock.releaseLock();}
}
// Password submission must be through the GAS HTML gate; never send passwords in a URL.
function passwordGate(slug,password,utm){
 slug=slug_(slug);password=String(password||'');if(password.length>128)throw Error('Invalid password');
 let succeeded=false,failed=false,result,gateError;
 let lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
 let cache=CacheService.getScriptCache(),key='gate-attempts:'+slug,attempts=Number(cache.get(key)||0);
 if(attempts>=12)throw Error('Too many attempts; try again in ten minutes.');
 let links=links_(),conf=configs_(),config=conf[slug]||{},decision=resolve_(links[slug],config);
 if(decision.status!=='protected')throw Error('Link is unavailable.');
 let raw=PropertiesService.getScriptProperties().getProperty('R12_PW_'+slug)||'',parts=raw.split('.');
 let correct=parts.length===2&&equal_(pwHash_(slug,password,parts[0]),parts[1]);
 if(!correct){cache.put(key,String(attempts+1),600);failed=true;throw Error('Incorrect password.');}
 cache.remove(key);
 let target=resolve_(links[slug],config,Date.now(),true);
 let params={};if(utm&&typeof utm==='object')Object.keys(utm).forEach(k=>{if(/^utm_(source|medium|campaign|content|term)$/.test(k))params[k]=String(utm[k]).slice(0,120);});
 if(target.status!=='redirect')throw Error('Link is unavailable.');
 succeeded=!!(config.analytics&&config.analytics.enabled);
 result={destination:queryUtm_(target.destination,target.utm,params),countdown:target.countdown,source:params.utm_source||''};
 }catch(ex){gateError=ex;}finally{lock.releaseLock();}
 if(failed)stats_(slug,'fail','');
 if(gateError)throw gateError;
 if(succeeded)stats_(slug,'redirect',result.source);
 return {destination:result.destination,countdown:result.countdown};
}

// Simple edit trigger: capture direct sheet edits without changing any redirect cells.
// Bulk edits may not supply old values; snapshots in editor are more complete.
function onEdit(e){
 try{
  if(!e||!e.range)return;let sh=e.range.getSheet(),name=sh.getName();
  if(name!== 'Redirects'&&name!==R12.SETTINGS)return;
  let first=e.range.getRow(),last=e.range.getLastRow();if(last<2)return;
  let history=table_(R12.HISTORY,['At','Slug','Editor','Action','BeforeJSON','AfterJSON']);
  for(let row=Math.max(2,first);row<=Math.min(last,first+49);row++){
   let slug=String(sh.getRange(row,1).getValue()||'').trim().toLowerCase();if(!R12.SLUG.test(slug))continue;
   history.appendRow([new Date(),slug,Session.getActiveUser().getEmail()||'sheet editor',
    'sheet_edit',JSON.stringify({oldValue:e.oldValue===undefined?null:e.oldValue}),
    JSON.stringify({sheet:name,range:e.range.getA1Notation(),row:sh.getRange(row,1,1,Math.min(5,sh.getLastColumn())).getDisplayValues()[0]})]);
  }
 }catch(ignore){}
}
