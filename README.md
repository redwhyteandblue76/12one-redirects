# 12one Redirects — advanced features

GitHub Pages frontend + Google Sheets + Google Apps Script. No Cloudflare Worker.

## Backward compatibility
The original Redirects tab columns must remain: Slug | Destination | Active | Notes | false_message.
Existing active links, disabled messages, slugs, and GitHub Pages branding remain unchanged. New settings default off.
New redirect.js supports both the old bulk JSONP response and the new per-slug API.

## Setup — required before enabling advanced features
1. Back up your spreadsheet and original Apps Script deployment/version.
2. In the existing Google Sheet's bound Apps Script project, replace Code.gs with this repository's Code.gs. Create two Apps Script HTML files named Editor and Gate by copying Editor.html and Gate.html from this repository. Use the V8 runtime.
3. Run setupRedirects as the sheet owner; authorize it. This creates RedirectSettings, RedirectAnalytics, and RedirectHistory, and initializes a private Script Properties password secret. It does not alter existing Redirects rows.
4. Publish the PUBLIC web app as Execute as Me / Anyone. Prefer creating a new version of the existing public deployment so its exec URL remains unchanged.
5. Set script property R12_PUBLIC_GATE_URL to that public /exec URL. If the URL changed, update API_URL in redirect.js.
6. Create a separate ADMIN web app deployment from the same project, Execute as User accessing the web app, limited to signed-in Google accounts. Open <admin-exec-url>?view=admin. Authorization checks against the spreadsheet owner and optional comma-separated script property R12_ADMIN_EMAILS.
7. Reload your sheet. Use 12one Redirects → Advanced editor for the Google Sheets sidebar.
8. Test the v2 Apps Script deployment before merging the GitHub Pages branch. GitHub commits never automatically deploy Apps Script.

## Data model
- Redirects: original columns A:E, directly editable.
- RedirectSettings: Slug | SettingsJSON | UpdatedAt. Optional JSON configuration stored per slug.
- RedirectAnalytics: DayUTC | Slug | Requests | Redirects | PasswordFailures | SourceCountsJSON.
- RedirectHistory: At | Slug | Editor | Action | BeforeJSON | AfterJSON.

Supported SettingsJSON sections: schedule (enabled,start,end,beforeUrl,duringUrl,afterUrl), availability (enabled,opensAt,expiresAt,beforeMessage,afterMessage), password (enabled), countdown (enabled,seconds,heading,message), analytics (enabled), utm (enabled,incomingPolicy,source,medium,campaign,content,term).
Schedule timestamps require an explicit ISO 8601 time zone offset or Z. Start is inclusive and end exclusive. Active=FALSE always takes precedence. Direct edits in RedirectSettings are allowed but can bypass editor validation.

## Editor
The full-page admin editor and Google Sheets sidebar use the same Editor.html and Apps Script administrative functions. Slugs are added in the original Redirects sheet; the editor modifies the selected existing link.
Editor saves log before/after JSON; direct sheet edits log an after snapshot, plus previous cell value when Apps Script supplies one. Multi-cell edits do not always expose reliable old values.
Preview evaluates configured time without changing live links or recording visits.

## Password protection
Protected destinations are omitted from public bulk JSONP and from per-slug lookups prior to password validation.
Password entry is on the Apps Script Gate.html page using google.script.run; passwords are not included in URLs. Password hashes and a secret pepper are stored in Script Properties, not the sheet.
The Apps Script HTML iframe sandbox may block automatic top-level redirects. After a successful password, the visitor clicks a Continue to destination link; a countdown can be shown, but hands-free navigation is not guaranteed for protected links.
Per-slug attempt throttling is best-effort and can affect all visitors to that slug during an attack. This is lightweight short-link gating, not strong authentication for sensitive information. Anyone with the final destination URL can still bypass the short-link password. Use destination-native permissions for private files.
Do not expose an anonymous Apps Script admin deployment.

## Analytics and UTM
Optional daily visit counts and UTM source totals are stored in Sheets. No IP addresses, precise unique-person tracking, or raw personal visitor identifiers are stored.
Apps Script and Sheets quotas apply; analytics are best-effort, writes may fail under high traffic. Browser or bot traffic can affect counts.
UTM values can be configured per link and/or received from an incoming short-link query string. Incoming-policy preserve favors incoming values; replace favors configured values.

## Deployment verification
- Existing active redirect continues to same destination.
- Existing inactive redirect retains its false_message.
- Missing and malformed slug show correct unavailable messages.
- Schedule boundaries and activation windows evaluated correctly.
- Public JSONP never discloses a protected destination.
- Password denial, correct password, link continuation, and rate limiting work.
- Countdown and UTM parameters work.
- Admin full-page editor and Sheets sidebar save to same spreadsheet.
- Direct Sheets edits take effect and appear in edit history.
- Analytics and preview perform as documented.

## Rollback
Restore the old Apps Script version on the original public deployment and revert redirect.js. Leave the original Redirects sheet intact. Additional settings tabs may be retained or archived.

Existing GitHub Pages 404 behavior is unchanged: arbitrary slug paths initially return HTTP 404 before JavaScript redirects. There are no server-side HTTP 301/302 responses.