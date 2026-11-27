# 13. Public share link (for people who are not signed in)

Written 26 Nov 2026. Code: `app/present/[product]`, `lib/client-presentation/share-token.ts`, `scripts/client-presentation/make-share-link.mjs`.

## What it is

The deck at `/module/lms/learning/client-presentation/scholarclone` stays behind sign-in, unchanged. For a client who has no account there is a **second address**:

    https://<site>/present/scholarclone?k=<signed link>

It opens that one deck and nothing else. It is **not** a hole in sign-in: it sets no cookie, creates no session, calls no API, and `proxy.ts` and `/module/*` were not touched.

## Why a signed link and not just a public page

A page anyone can open is found by search engines, guessed, scraped and forwarded forever. A signed link is the same convenience ("click and it opens") with these limits:

| Limit | How |
|---|---|
| Cannot be made up or widened | HMAC-SHA256 with a secret that only the server has. Changing one character, the expiry or the deck breaks it. |
| Opens one deck only | The deck key is inside the signature. |
| Ends by itself | Every link has an expiry (mint script: 14 days by default, 90 at most). |
| One client's link can be switched off | Each link has an id. Put it in `CLIENT_PRESENTATION_REVOKED_IDS` and redeploy. Rotating the secret switches off all links. |
| Fails closed | No secret set (or a short one) means every request is a plain 404. Deploying this code alone opens nothing. |
| Says nothing when refused | Missing, forged, expired, revoked, wrong deck, unknown deck: the same 404. |
| Not indexed, cached, framed or passed on | Meta robots, `X-Robots-Tag`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` on everything under `/present`, including the 404. |
| No presenter notes in what is sent | The notes ("never click Assign Learning", "staff capability is not connected...") are not in the JavaScript the public page loads. See below. |

## Set up once (owner)

1. `node --import tsx scripts/client-presentation/make-share-link.mjs --new-secret` prints a random secret. Copy it to your password manager.
2. Vercel > the g2gv0 project > Settings > Environment Variables: add `CLIENT_PRESENTATION_SHARE_SECRET` = that value (Production). Redeploy.
3. Mint a link, with the secret in the environment (never as an argument):

       CLIENT_PRESENTATION_SHARE_SECRET=<secret> node --import tsx scripts/client-presentation/make-share-link.mjs --base https://g2gv0.vercel.app --days 14

   It prints the link, the **link id** and the expiry. Write the id next to the client's name. The script stores nothing.

A link that never expires: add `--no-expiry` instead of `--days`. It stays valid until 1 January 2100 and can still be switched off by its id (or by changing the secret). Use it only for someone you will always want to reach, and keep a note of who holds it.

## Switch a link off

Add its id to `CLIENT_PRESENTATION_REVOKED_IDS` (comma separated), then redeploy. To end every link at once, change the secret.

## What it does NOT protect (be honest with the client and with yourself)

- Anyone who has the link can open the deck until it expires, and can forward it. That is what a public link is. Send it to the person it is for, with a short expiry.
- The deck's pictures and videos are ordinary files under `/client-presentation/...` and were already public before this change (they are not behind sign-in). They are client-facing material with no personal data.
- The page's JavaScript files (`/_next/static/...`) are public like on any website. They contain the slide text that the deck shows, which is the point, and they do **not** contain the presenter notes or the image-slot briefs.
- The sign-in itself: `proxy.ts` only checks that a cookie named `gtg-session` exists (any value), so it is a routing aid, not a security boundary. The protection of school data is the API behind it. That was already true; it is why this feature does not make a cookie or use one.

## Before the first client uses it

- The link only works on the **production** address (the deployment that has the secret). A preview address (`g2gv0-git-...vercel.app`) sits behind Vercel's own login, so a client cannot open it. The code has to be merged and deployed first.
- Add the secret **before** deploying, or the page is simply a 404 (safe, but nothing opens).
- Open the link once yourself in a private window and check the first slide says "What is your school not seeing?".
- Not checked yet: whether Vercel Web Analytics (loaded for every production page by the root layout) keeps the `?k=` part of the address in its dashboard. If it does, only your own Vercel team can see it, but treat the dashboard as holding live links until the expiry passes.

## How it was checked (26 Nov 2026, local production build, throwaway secret)

| Check | Result |
|---|---|
| Valid link | 200, no `Set-Cookie`, robots / no-store / no-referrer / frame-deny headers present |
| No `k`, empty, garbage, last or payload character changed, `k` sent twice | 404 each |
| Correctly signed but expired / revoked / minted for another deck | 404 each |
| Valid link on an unknown deck, with a `..%2F` path | 404 |
| Forged `gtg-session=1` cookie with no link, or with a garbage link | 404 (the cookie opens nothing here) |
| Server with no secret, given a link signed with another server's secret | 404 |
| Headers on the 404 | same set as the 200 |
| 404 page echoing the submitted query | JSON-escaped (`<`), no reflected script |
| `/module/.../scholarclone` and `/atlas/a1` with no cookie, with or without a share link | 307 to `/login`, as before |
| Clean browser on the link | Slide 1 headline exact; pages through slides; `?slide=201` opens the product hub and key `1` opens a product; `?mode=short` and `?embed=1` behave; P key opens nothing and the Presenter notes button is absent |
| Same browser's traffic | 35 requests, all to the one origin, all GET, none to an API or login, 0 cookies, empty localStorage and sessionStorage |
| Notes in the JavaScript the public page downloaded | 0 of 17 files. Negative control: the same notes ARE in exactly 1 built chunk, which the public page never loads |
| Signed-in deck (local test session, non-local requests blocked) | Presenter window opens with P, shows Say, Ask and a Careful note, follows the audience window |
| Unit tests | 19 new (forgery at every character position, expiry boundary, revocation, short or missing secret, non-canonical spelling, wrong-shape payloads); full `lib` suite 4,294 pass |
| Mutation | making the public page import the presenter view fails `public-deck.test.ts` |

The tester also saw one 404 for `/_vercel/insights/script.js`: that is Vercel's analytics script, which only exists on Vercel's hosting. It is not part of this feature.

## Keeping the notes out of the public bundle

`export-deck.mjs` now writes two files from the story:

- `generated/scholarclone.deck.json`: complete, as before. Read by the PowerPoint builder, `verify.mjs` and `presenter-deck.ts` (the signed-in presenter window).
- `generated/scholarclone.public.json`: what a viewer sees, with `say`, `ask`, `transition`, `limits`, image-slot briefs, `appendix` and the source hash removed. `deck.ts`, `film-scenes.tsx` and `clip-player.tsx` import this one.

`lib/client-presentation/public-deck.test.ts` fails if a note appears in the public file, if anything reachable from `app/present` imports the full file, `presenter-deck.ts` or the presenter window, or if a second file starts importing the full file.

If you change the story, run `node scripts/client-presentation/export-deck.mjs` and commit **both** generated files.
