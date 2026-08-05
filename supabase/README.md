# Workshop registration backend

The workshop registration form on `/telepathy-meditation-workshop` writes to
Supabase. Nothing about it is part of the static build, so `build.py` is
unaffected.

## How a registration flows

1. The visitor fills the form and attaches a payment receipt. The browser
   downscales ordinary images to 1600px JPEG so uploads stay small on a phone.
2. `POST /api/workshop-register` (Vercel) forwards the JSON to the
   `workshop-register` Edge Function.
3. The Edge Function validates the fields, refuses anything without a receipt,
   stores the file in the private `mindcare-receipts` bucket and inserts a row
   into `public.mindcare_workshop_registrations`.

Staff read it back at `/submissions`, which rewrites to `/api/submissions` and
proxies to the `workshop-submissions` Edge Function. That function checks the ID
and password, sets a signed 8 hour session cookie, and renders the table with
one hour signed links to each receipt. It also offers search and a CSV export.

## Where things live

| Piece | Location |
| --- | --- |
| Supabase project | `MindCare` tables inside the `TalkLive` project, `kcamfetippgrawhgiabo` |
| Table | `public.mindcare_workshop_registrations` |
| Receipts | Storage bucket `mindcare-receipts`, private |
| Functions | `supabase/functions/*`, deployed with `verify_jwt = false` |
| Vercel proxies | `api/workshop-register.js`, `api/submissions.js` |

## Security notes

- The table has RLS enabled and forced with zero policies, and `anon` and
  `authenticated` have had every privilege revoked. Only the service role can
  read or write it, and that key exists only inside the Supabase Edge runtime:
  it is never in this repository, in Vercel, or in the browser.
- The receipts bucket is private. The only way to see a receipt is a signed URL
  minted by the submissions page after a successful login.
- Both Edge Functions run with `verify_jwt = false` because they are reached by
  the public website, not by Supabase auth users. `workshop-submissions`
  implements its own ID/password check instead.
- The submissions password is stored as a salted SHA-256 digest, not plaintext.

## Rotating the submissions password

Compute a new digest and set it as a function secret, no redeploy needed:

```sh
printf 'mindcare-submissions:<new-id>:<new-password>' | sha256sum
# then set SUBMISSIONS_HASH to that value in the Supabase dashboard,
# Edge Functions -> Secrets
```

## Deploying a function change

```sh
supabase functions deploy workshop-register    --project-ref kcamfetippgrawhgiabo --no-verify-jwt
supabase functions deploy workshop-submissions --project-ref kcamfetippgrawhgiabo --no-verify-jwt
```
