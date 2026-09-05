# Website submissions backend

Every form on themindcareservices.com writes to Supabase through the same
Edge Function, and every submission is emailed to
**shaistatariq2002@gmail.com**. That address is hard-coded in
`workshop-register/index.ts`; configuration can only ever add recipients on top
of it, never replace it.

| Form | Page | `kind` |
| --- | --- | --- |
| Course registration (paid, with receipt) | `/montessori-course/register` | `workshop` |
| Workshop registration (free seat) | `/montessori-workshop/register` | `workshop` |
| Free consultation request | `/contact` | `consultation` |
| Appointment request | `/contact` | `appointment` |
| General question | `/contact` | `question` |

`build.py` only generates `/services/*`, `/team/*`, the SEO pages, the articles
and `confirmed.html`. The course, workshop and contact pages are hand-edited.

## The email alerts

Alerts are live and go out through **Email Bump**. The API key and the recipient
list are stored in `public.mindcare_settings` (service role only), so they can be
changed from the dashboard rather than from the Supabase console.

| Setting | Value |
| --- | --- |
| Provider | Email Bump, `POST https://emailbump.com/api/v1/emails` |
| Always emailed | `shaistatariq2002@gmail.com` (hard-coded, cannot be turned off) |
| Also emailed | `asadsyed711@gmail.com` (the `extra_to` setting) |
| Sender | Email Bump's shared `noreply@viaemailbump.com`, until the DNS below is published |

Email Bump meters each send separately and takes **one** address per call, so the
function loops over the recipients and sends one message each.

To change any of it: open **https://themindcareservices.com/submissions**, sign
in, tap **Settings**, then **Send test email** to prove the change. Function
secrets (`RESEND_API_KEY`, `EMAIL_API_KEY`, `EMAIL_PROVIDER`, `NOTIFY_FROM`,
`NOTIFY_TO`, `SMTP_*`) still work and take priority over anything stored here.

Resend, Brevo, SendGrid and plain SMTP are supported the same way; the provider
is inferred from the shape of the key (`ebk_`, `re_`, `xkeysib-`, `SG.`) unless
one is picked explicitly.

## Keeping the alerts out of spam

Gmail decides where a message lands almost entirely on who it says it is from.
Right now the alerts are sent from Email Bump's shared `noreply@viaemailbump.com`,
which authenticates properly but is not our brand. Publishing these six records
at the DNS host for themindcareservices.com finishes the job:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | `tmnyilixpzvyy6htg2dxic76paev4g2a._domainkey` | `tmnyilixpzvyy6htg2dxic76paev4g2a.dkim.amazonses.com` |
| CNAME | `2xe4vm657iy5ehya6hebvb2hlyzpnyav._domainkey` | `2xe4vm657iy5ehya6hebvb2hlyzpnyav.dkim.amazonses.com` |
| CNAME | `nfzgpclolpnw3v3r6qnxecolbmptjysd._domainkey` | `nfzgpclolpnw3v3r6qnxecolbmptjysd.dkim.amazonses.com` |
| MX (priority 10) | `mail` | `feedback-smtp.us-east-1.amazonses.com` |
| TXT | `mail` | `v=spf1 include:amazonses.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

The domain is already registered with Email Bump (id
`e1b5c916-5bbd-473a-9f15-e728c8f5321d`); it verifies itself within minutes of the
records going live. Two things to watch:

- The `mail` SPF record is for the MAIL FROM subdomain and is separate from any
  SPF record on the root domain. The root record must keep listing Zoho, which
  carries the ordinary mailboxes: `v=spf1 include:zoho.com ~all`. A domain may
  only have one SPF record, so add to it rather than replacing it.
- Once verified, open **Settings** on the dashboard and set **Send from** to
  `MindCare Website <alerts@themindcareservices.com>`. That one change also turns
  on the short confirmation email to the person who registered, which is
  deliberately suppressed while the sender is a shared one.

Then mark the first alert **Not spam** in Gmail if it lands anywhere but the
inbox, and add a filter on the sender with *Never send it to Spam*. Gmail weights
recipient behaviour heavily, and this makes it permanent.

The function already does the message-side work: every alert carries both a
plain-text and an HTML part, a `Reply-To` pointing at the person who wrote in, a
plain factual subject line, and a unique reference header so Gmail does not
collapse separate registrations into one trimmed thread.

## How a submission flows

1. The page posts JSON to `/api/contact` or `/api/workshop-register` (Vercel).
   Both proxy to the `workshop-register` Edge Function; only `kind` differs.
2. The function validates the fields. A registration must have a name,
   institute, phone, email and education; a contact form needs a name and either
   a phone number or an email. A filled-in hidden `company` field (the honeypot)
   is accepted and silently dropped, and more than eight submissions from one IP
   in ten minutes are refused.
3. When `paid` (or the legacy `certificate`) is true it refuses anything without
   a receipt and stores the file in the private `mindcare-receipts` bucket;
   otherwise `receipt_path` stays null. Either way a row goes into
   `public.mindcare_workshop_registrations`.
4. The alert email goes out, and whether it worked is written back onto the row
   as `notify_status`. A failure shows as a red badge on that card at
   `/submissions`, so a broken provider is never silent again.
5. Every subscribed phone is rung over Web Push.
6. If a sender on our own domain is configured, the person who wrote in also
   gets a short confirmation. This is skipped while the sender is one of the
   providers' shared addresses, because mailing strangers from a borrowed sender
   is how that sender gets marked as spam.

The fee breakdown is carried in the `workshop` text field, e.g.
`Montessori Teacher Training Course (3 Months) · Registration PKR 2,500 + Certificate
PKR 3,500 · Total PKR 6,000`, so what someone paid for is stored, emailed and
exported without needing a column per add-on. `fee_summary` and `notes` are sent
too but are used only to compose the alert email; `certificate` remains the
stored boolean for the certificate add-on.

## The dashboard

`/submissions` rewrites to `/api/submissions` and proxies to the
`workshop-submissions` Edge Function. It checks the ID and password, sets a
signed one year session cookie that is renewed on every visit (so a phone stays
signed in until Sign out is tapped), and renders one card per submission.

Cards are filtered by search and by the kind chips together. Registrations are
badged by what was paid, everything else by which form it came from, and any
submission whose alert email failed carries a red badge with the provider's own
error in its tooltip. Receipts get one hour signed links. There is a CSV export
and a per-submission delete.

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
| Notification settings | `public.mindcare_settings` (service role only: holds the provider credential and the VAPID pair) |
| Push subscriptions | `public.mindcare_push_subscriptions` |
| Receipts | Storage bucket `mindcare-receipts`, private |
| Functions | `supabase/functions/*`, deployed with `verify_jwt = false` |
| Vercel proxies | `api/workshop-register.js`, `api/contact.js`, `api/submissions.js` |

## Security notes

- Every table here has RLS enabled and forced with zero policies, and `anon` and
  `authenticated` have had every privilege revoked. Only the service role can
  read or write them, and that key exists only inside the Supabase Edge runtime:
  it is never in this repository, in Vercel, or in the browser.
- `mindcare_settings` holds the email credential, so it is locked down the same
  way as the registrations table and is only ever reachable through the
  password-protected dashboard.
- The receipts bucket is private. The only way to see a receipt is a signed URL
  minted by the submissions page after a successful login.
- Both Edge Functions run with `verify_jwt = false` because they are reached by
  the public website, not by Supabase auth users. `workshop-submissions`
  implements its own ID/password check instead, and the **Send test email**
  button proves who it is to `workshop-register` with that same session cookie:
  both functions sign it with the service role key, so no credential is shared.
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

Alongside the email, every submission can ring the staff phones. This needs no
configuration at all: the VAPID pair lives in `mindcare_settings` and both
functions read it from there.

1. Open `/submissions` on the phone, install it to the home screen, and tap
   **Alerts**. The browser registers `/sw.js`, asks for notification
   permission and stores the subscription in
   `public.mindcare_push_subscriptions`. Tapping again turns alerts back off.
2. `workshop-register` signs a VAPID token per push service and sends a
   payload-less push to every stored subscription, so no submission details
   travel through Google's or Apple's servers. Tapping the notification opens
   `/submissions`.
3. Dead subscriptions (404/410) are deleted automatically.

`VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` still work as function secrets and
override the stored pair if they are set.

iOS only delivers push to a PWA that was added to the home screen; on Android
Chrome the installed app or the browser tab both work.
