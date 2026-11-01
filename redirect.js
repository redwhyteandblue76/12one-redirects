'use strict';
const API_URL = 'https://script.google.com/macros/s/AKfycbx2XLJeq_BDcPy_l6IoXTtFqf8fLs1kKO77B_D9MbE6hjymfuCb5nMZbgpc2x56_Tz_/exec';
const heading = document.getElementById('heading');
const message = document.getElementById('message');
function show(title, description) {
  heading.textContent = title;
  message.textContent = description;
  document.querySelector('.circle').textContent = '↗';
}
function slugFromPath() {
  let path;
  try { path = decodeURIComponent(location.pathname); } catch { return null; }
  const slug = path.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!slug || slug === 'index.html' || slug === '404.html') return '';
  return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug) ? slug : null;
}
function fetchJsonp() {
  return new Promise((resolve, reject) => {
    const cb = '__r12one_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => { clearTimeout(timer); script.remove(); delete window[cb]; };
    const finish = (err, result) => { if (settled) return; settled = true; cleanup(); err ? reject(err) : resolve(result); };
    window[cb] = result => finish(null, result);
    script.onerror = () => finish(new Error('Could not load redirect data'));
    const timer = setTimeout(() => finish(new Error('Redirect lookup timed out')), 12000);
    const url = new URL(API_URL);
    url.searchParams.set('callback', cb);
    url.searchParams.set('_', Date.now().toString());
    script.src = url.href;
    document.head.appendChild(script);
  });
}
(async () => {
  const slug = slugFromPath();
  if (slug === '') { show('Short links, made simple.', 'This domain hosts 12one short links. Open a complete link to continue.'); return; }
  if (slug === null) { show('Invalid short link', 'Check the address and try again.'); return; }
  try {
    const data = await fetchJsonp();
    if (!data || !data.redirects || typeof data.redirects !== 'object') throw new Error('Invalid API response');
    const destination = data.redirects[slug];
    if (typeof destination !== 'string') {
      const disabled = data.disabled && Object.prototype.hasOwnProperty.call(data.disabled, slug);
      if (disabled) {
        const customMessage = data.disabled[slug];
        show('Link currently unavailable', typeof customMessage === 'string' && customMessage.trim() ? customMessage : 'This link is currently disabled.');
      } else {
        show('Link not found', 'This short link does not exist.');
      }
      return;
    }
    const target = new URL(destination);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('Unsafe URL');
    show('Redirecting…', 'Taking you to your destination.');
    location.replace(target.href);
  } catch (error) {
    console.error(error);
    show('Link unavailable', 'The destination could not be loaded. Try again shortly.');
  }
})();