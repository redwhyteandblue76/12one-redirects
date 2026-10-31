# 12one Redirects

Static GitHub Pages redirect frontend for https://r.12one.page, backed by a Google Sheet.

## Sheet
Make a tab called `Redirects`, columns `Slug | Destination | Active | Notes`. Example row: `google | https://www.google.com | TRUE | Test`.

## Apps Script
Paste the contents of `Code.gs` into the Sheet's Extensions → Apps Script. Under Deploy → Manage deployments, edit the Web App and deploy a **new version**. Execute as **Me**, access **Anyone**. The frontend expects a JSONP response (`callback(...)`), not regular JSON.

Current endpoint: `https://script.google.com/macros/s/AKfycbx2XLJeq_BDcPy_l6IoXTtFqf8fLs1kKO77B_D9MbE6hjymfuCb5nMZbgpc2x56_Tz_/exec`.

## GitHub Pages and DNS
In Settings → Pages, select Deploy from a branch → main → /(root). Set custom domain to `r.12one.page`. In Cloudflare DNS create a CNAME `r` pointing to `redwhyteandblue76.github.io` (DNS only). Enable Enforce HTTPS once the certificate is ready.

## Limitations
Unknown routes use GitHub Pages' `404.html`; the initial HTTP response is a 404, and browser JavaScript redirects afterward. Some bots, previews, and integrations won't follow it. No click analytics; API publicly exposes active destination URLs but not editing privileges. Never put secrets in this repository.
