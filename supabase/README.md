# Workshop registration backend

The registration form on `/telepathy-meditation-register` writes to Supabase.
The page itself comes from `build.py`; the backend below does not.

The workshop is free. The only payment anywhere on the site is the optional
certificate of participation (a one-time PKR 1,000), so a receipt is required
only from people who ask for one.

## How a registration flows

1. Step one of the form collects the visitor's details. Step two asks whether
   they want the certificate; only then are the bank details and the receipt
   upload shown. The browser downscales ordinary images to 1600px JPEG so
   uploads stay small on a phone.
2. `POST /api/workshop-register` (Vercel) forwards the JSON to the
   `workshop-register` Edge Function.
3. The Edge Function validates the fields. When `certificate` is true it
   refuses anything without a receipt and stores the file in the private
   `mindcare-receipts` bucket; otherwise `receipt_path` stays null. Either way
   it inserts a row into `public.mindcare_workshop_registrations`.

Staff read it back at `/submissions`, which rewrites to `/api/submissions` and
proxies to the `workshop-submissions` Edge Function. That function checks the ID
and password, sets a signed 8 hour session cookie, and renders one card per
registration, badged free or paid certificate, with one hour signed links to the
receipts that exist. It also offers search, a CSV export and per-registration
delete.

The layout is a card grid rather than a table so the page fits any width without
scrolling sideways, and collapses to a single column on a phone.

Deleting removes the row and its receipt together. It needs a live session, the
id has to be a UUID before any query runs, and the browser asks for confirmation
first. If the row goes but the stored receipt will not, the failure is logged and
the delete still counts: an orphaned file is a smaller problem than a row that
refuses to disappear.

## Where things live

| Piece | Location |
| --- | --- |
| Supabase project | `MindCare` tables inside the `TalkLive` project, `kcamfetippgrawhgiabo` |
| Table | `public.mindcare_workshop_registrations` |
| Receipts | Storage bucket `mindcare-receipts`, private |
| Functions | `supabase/functions/*`, deployed with `verify_jwt = false` |
| Vercel proxies | `api/workshop-register.js`, `api/submissions.js` |

The table carries a `certificate boolean not null default false`, and
`receipt_path` is nullable: free registrations have no receipt at all.

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
