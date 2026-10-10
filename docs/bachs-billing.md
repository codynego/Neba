# Bachs billing setup

GetNeba keeps pricing and entitlement decisions on the backend. Bachs hosts checkout and billing; GetNeba never receives card details.

## Sandbox setup

1. Create a Bachs sandbox account and API key with checkout, customer, and product access.
2. Create two recurring products in Bachs:
   - GetNeba Plus Monthly — `USD 5.00`, recurring monthly
   - GetNeba Plus Yearly — `USD 48.00`, recurring yearly
3. Register a webhook destination at `https://YOUR_API_HOST/api/billing/webhook/` and subscribe to `collection.succeeded`, `checkout.completed`, `checkout.expired`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
4. Copy the webhook signing secret and set these backend variables:

```text
BACHS_API_KEY=sk_sandbox_...
BACHS_WEBHOOK_SECRET=...
BACHS_BASE_URL=https://sandbox-api.bachs.io
BACHS_PLUS_MONTHLY_PRODUCT_ID=prod_...
BACHS_PLUS_YEARLY_PRODUCT_ID=prod_...
BILLING_PLUS_MONTHLY_PRICE=5.00
BILLING_PLUS_YEARLY_PRICE=48.00
BILLING_PLUS_CURRENCY=USD
```

Run `python manage.py migrate` before testing. The public `/pricing` page keeps Plus checkout disabled until the key and product IDs are present. Credits use a server-priced NGN checkout and do not need a catalog product.

## Production cutover

After sandbox tests pass, verify the Bachs account, create equivalent live products, switch to `sk_live_...` and `https://api.bachs.io`, and register the production webhook URL. Do not fulfil from the browser redirect: the signed `collection.succeeded` webhook is the source of truth. Webhook event IDs are deduplicated locally, and credit purchases require an exact amount/currency match before credits are added.

## Customer billing

When a member has an active subscription, `/billing` calls Bachs to mint a short-lived customer portal session. The member can view invoices, update payment details, change or cancel the subscription there. Subscription access is updated from Bachs subscription webhooks.
