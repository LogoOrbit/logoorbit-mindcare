# Workshop registration backend

The registration form on `/montessori-course/register` writes to Supabase.
The course and workshop pages are hand-maintained; `build.py` only generates
`/services/*` and `/team/*`.

Two Montessori offerings share this backend: the paid three-month course at
`/montessori-course` and the free three-day workshop at `/montessori-workshop`,
whose form still sends the old free-seat payload.

The Montessori Teacher Training Course charges a **PKR 2,500 registration fee**,
with two optional extras: the course notes as a PDF (PKR 1,000) and the MindCare
Services Certificate (PKR 3,500). Payment is a bank transfer made before the form
is submitted, and the screenshot of it is attached to the submission, so every
registration for this course carries a receipt.

The older free workshops sent `certificate: true` when someone bought the
optional certificate and nothing otherwise; that path still works unchanged.

## How a registration flows

1. Step one of the form collects the visitor's details. Step two shows the fee:
   the compulsory registration fee, two optional add-ons, a running total, the
   bank details and the receipt upload. The browser downscales ordinary images
   to 1600px JPEG so uploads stay small on a phone.
2. `POST /api/workshop-register` (Vercel) forwards the JSON to the
   `workshop-register` Edge Function.
3. The Edge Function validates the fields. When `paid` (or the legacy
   `certificate`) is true it refuses anything without a receipt and stores the
   file in the private `mindcare-receipts` bucket; otherwise `receipt_path`
   stays null. Either way it inserts a row into
   `public.mindcare_workshop_registrations`.

The fee breakdown is carried in the `workshop` text field, e.g.
`Montessori Teacher Training Course (3 Months) · Registration PKR 2,500 + Certificate
PKR 3,500 · Total PKR 6,000`, so what someone paid for is stored, emailed and
exported without needing a column per add-on. `fee_summary` and `notes` are sent
too but are used only to compose the alert email; `certificate` remains the
stored boolean for the certificate add-on.

Staff read it back at `/submissions`, which rewrites to `/api/submissions` and
proxies to the `workshop-submissions` Edge Function. That function checks the ID
and password, sets a signed one year session cookie that is renewed on every
visit (so a phone stays signed in until Sign out is tapped), and renders one card per
registration, badged paid or free by whether a receipt was attached, with one hour
signed links to the receipts that exist. It also offers search, a CSV export and per-registration
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
| Push subscriptions | `public.mindcare_push_subscriptions` |
| Receipts | Storage bucket `mindcare-receipts`, private |
| Functions | `supabase/functions/*`, deployed with `verify_jwt = false` |
| Vercel proxies | `api/workshop-register.js`, `api/submissions.js` |

The table carries a `certificate boolean not null default false`, and
`receipt_path` is nullable: free registrations have no receipt at all. No schema
change was needed for the paid course, because the fee breakdown travels inside
the existing `workshop` text column.

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

## Phone alerts (Web Push)

Alongside the email, every registration can ring the staff phones.

1. Open `/submissions` on the phone, install it to the home screen, and tap
   **Alerts**. The browser registers `/sw.js`, asks for notification
   permission and stores the subscription in
   `public.mindcare_push_subscriptions` (service role only, same lockdown as
   the registrations table). Tapping again turns alerts back off.
2. `workshop-register` signs a VAPID token per push service and sends a
   payload-less push to every stored subscription, so no registration details
   travel through Google's or Apple's servers. Tapping the notification opens
   `/submissions`.
3. Dead subscriptions (404/410) are deleted automatically.

The VAPID public key is in the source of both functions - the browser needs it.
The private half must be set once as a Supabase function secret, otherwise the
push step is skipped silently and only the email goes out:

```
supabase secrets set VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:info@themindcareservices.com
```

iOS only delivers push to a PWA that was added to the home screen; on Android
Chrome the installed app or the browser tab both work.
