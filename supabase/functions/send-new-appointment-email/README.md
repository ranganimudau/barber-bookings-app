# Send Barber Email on New Appointment

This Edge Function sends the barber an email when a client creates a new appointment. It is triggered by a **Database Webhook** on `INSERT` into `appointments`.

## Prerequisites

- Barbers have an **email** in the `profiles` table (they sign up with email).
- A [Resend](https://resend.com) account and API key (free tier works).

## 1. Get a Resend API key

1. Sign up at [resend.com](https://resend.com).
2. In the dashboard, create an API key.
3. For testing you can use the default "From" address `onboarding@resend.dev` (Resend sandbox). For production, add and verify your own domain in Resend.

## 2. Deploy the Edge Function

From the project root (where `supabase` folder is):

```bash
npx supabase functions deploy send-new-appointment-email
```

If you don't use Supabase CLI, you can deploy from the **Supabase Dashboard**: Project → Edge Functions → New function → paste the code from `index.ts`.

## 3. Set secrets

In Supabase Dashboard: **Project Settings → Edge Functions → Secrets**, add:

| Name             | Value        |
|------------------|-------------|
| `RESEND_API_KEY` | Your Resend API key (e.g. `re_...`) |

Optional:

| Name         | Value                          |
|--------------|--------------------------------|
| `FROM_EMAIL` | Sender email (e.g. `noreply@yourdomain.com`) |
| `FROM_NAME`  | Sender name (e.g. `Barber Bookings`)         |

If you don’t set `FROM_EMAIL`/`FROM_NAME`, the function uses `onboarding@resend.dev` and "Barber Bookings" (Resend sandbox).

## 4. Create the Database Webhook

In **Supabase Dashboard**:

1. Go to **Database → Webhooks**.
2. Click **Create a new hook**.
3. Set:
   - **Name:** e.g. `Notify barber on new appointment`
   - **Table:** `appointments`
   - **Events:** tick **Insert**
   - **Type:** **Supabase Edge Functions**
   - **Edge Function:** `send-new-appointment-email` (or the URL below if you deploy manually)

If your dashboard has a **URL** option instead:

- **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-new-appointment-email`
- **HTTP Headers:**  
  `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`  
  (from Project Settings → API → `service_role` key)

Replace `YOUR_PROJECT_REF` with your project reference (e.g. from your `supabaseClient.js` URL).

## 5. Verify

1. As a client, create a new appointment in the app.
2. The barber’s email (from `profiles` where `id` = `barber_id`) should receive an email with the appointment details.

If nothing arrives, check Edge Function logs in the Dashboard (Edge Functions → `send-new-appointment-email` → Logs) and ensure `profiles` has an `email` for the barber.
