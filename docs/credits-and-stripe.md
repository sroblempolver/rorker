# Credits and plans

How credits work on the build site, and what Stripe needs before real payments.

## What's built

- **One config:** `web/src/lib/credits/config.ts` holds every number (tier prices, monthly credits,
  plan, floor and square-foot limits, pack prices, what each action costs, welcome and referral
  bonuses). All of them are placeholders. After changing one, run `node web/preview/build-links.mjs`
  and redeploy the `credits` edge function so the server uses the same numbers.
- **Rules:** `web/src/lib/credits/rules.ts` (costs, limit checks with the smallest tier that fits,
  monthly credits, unused monthly credits running out). The page and the edge function run the same code.
- **Database** (`supabase/build/20261029000003_credits.sql`): `credit_plans` (account kind and tier) and
  `credit_ledger` (every change, the balance is the sum). Members can read their own; only the edge
  function writes, through `credit_add`, which locks the account so two spends can't use the same credits.
- **Edge function** (`supabase/functions/credits`, its own function so `build` is untouched): `credits`, `spend`, `buy`, `tier`, `kind`. Spending
  checks the tier limits first, then the balance. `buy` and `tier` only work while `testPayments` is on.
- **Page:** a credit chip in the header, the Credits and plan page (`#/credits`), and a prompt when an
  action needs more credits or a bigger plan. Charged now: a new plan (New project, or a job's first
  drawn plan), each assistant question, and each thing placed on a plan (homeowners only; free for
  businesses). Realistic voice and 3D renders are on the price list as "coming".
- **Account kind:** from sign-up (a company name means a business; left blank, a homeowner). It can be
  switched at the bottom of the Credits page.
- **Referral bonus:** when a contractor takes on a homeowner's project and is on (or later starts) a paid
  plan, the homeowner gets the bonus once per contractor (paid when the contractor's credits load or they change tier).

## Known gaps

- The page writes its own jobs and plans (row-level security lets admins in), so the plan-count and size
  limits are checked by the page asking the server first; someone editing requests by hand could skip
  them. Credits can't be faked: only the server adds ledger lines. Moving plan saves through the server
  closes this later.
- Floors and square feet come from the page (the plan isn't saved yet when it's checked).

## What Stripe needs

1. **Stripe account** for Rorker itself (separate from contractors' Stripe Connect accounts for client
   payments). Keys as Supabase function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
2. **Products and prices:** one recurring monthly price per paid tier (Pro, Team, Business), one one-time
   price per credit pack. Put the Stripe price ids next to each tier and pack in `config.ts`.
3. **Checkout:** `buy` and `tier` create a Stripe Checkout Session (mode `payment` for a pack,
   `subscription` for a tier) with the account id in `client_reference_id` and metadata, and return its
   URL; the page sends the person there. Store the Stripe customer id in `credit_plans.customer_ref`.
4. **Webhook** (a new edge function, `stripe`, `verify_jwt` off, signature checked):
   - `checkout.session.completed` (pack): add a `purchase` line with ref `stripe:<session id>` so a
     retried webhook never adds it twice.
   - `customer.subscription.created/updated`: set `tier` and `subscription_ref`; run the referral bonus.
   - `invoice.paid` (each month): the plan's monthly credits (today they're added on the 30-day clock;
     switch the period to the Stripe billing period).
   - `customer.subscription.deleted`: back to Free.
   - `charge.refunded`: a `refund` line taking the credits back.
5. **Customer portal** link on the Credits page for card changes, cancelling and invoices.
6. Turn `testPayments` off in `config.ts` once the above works.
