import { getIkas } from '@/helpers/api-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { validateIkasWebhookSignature, type IkasWebhook } from '@ikas/admin-api-client';
import { NextRequest, NextResponse } from 'next/server';

/** App client secret used to verify the HMAC-SHA256 webhook signature. */
const CLIENT_SECRET = process.env.CLIENT_SECRET;

/** ikas stock webhook scopes handled by this endpoint. */
const STOCK_SCOPES = ['store/stock/created', 'store/stock/updated'];

/**
 * Shape of the parsed `data` payload for stock webhooks.
 *
 * ikas serializes the event body as a JSON string in `IkasWebhook.data`.
 * We parse it defensively because the stock payload may expose the location
 * id either as `stockLocationId` or `locationId` depending on the event.
 */
type StockWebhookData = {
  id?: string;
  productId?: string;
  variantId?: string;
  stockLocationId?: string;
  locationId?: string;
  stockCount?: number;
};

/**
 * POST /api/ikas/webhook
 *
 * Receives ikas webhook events. When a stock change arrives
 * (`store/stock/created` | `store/stock/updated`) the corresponding product
 * variant stock is updated in ikas via the `saveVariantStocks` mutation.
 *
 * Flow:
 * 1. Read the raw body and parse the ikas webhook envelope.
 * 2. Verify the HMAC-SHA256 signature with the app client secret.
 * 3. Resolve the merchant's auth token from the webhook `authorizedAppId`.
 * 4. Parse the stock payload and update the relevant product variant.
 */
export async function POST(request: NextRequest) {
  try {
    if (!CLIENT_SECRET) {
      // Misconfigured deployment; never proceed without a secret to verify against.
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // 1. Parse the webhook envelope from the raw request body.
    const rawBody = await request.text();
    let webhook: IkasWebhook;
    try {
      webhook = JSON.parse(rawBody) as IkasWebhook;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 2. Verify the signature before trusting any payload data.
    if (!validateIkasWebhookSignature(webhook, CLIENT_SECRET)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Acknowledge non-stock events so ikas does not retry them.
    if (!STOCK_SCOPES.includes(webhook.scope)) {
      return NextResponse.json({ success: true, skipped: webhook.scope });
    }

    // 3. Resolve the merchant's stored auth token for this installation.
    const authToken = await AuthTokenManager.get(webhook.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
    }

    // 4. Parse the stock payload (signature already verified above).
    let stock: StockWebhookData;
    try {
      stock = JSON.parse(webhook.data) as StockWebhookData;
    } catch {
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    const productId = stock.productId;
    const variantId = stock.variantId;
    const stockLocationId = stock.stockLocationId ?? stock.locationId;
    const stockCount = stock.stockCount;

    // Without full identifiers we cannot target a variant; acknowledge and stop.
    if (!productId || !variantId || !stockLocationId || typeof stockCount !== 'number') {
      return NextResponse.json({ success: true, message: 'Insufficient stock payload' });
    }

    // Apply the incoming stock to the related product variant. Setting the same
    // value is idempotent, so re-processing a delivery will not diverge state.
    const ikasClient = getIkas(authToken);
    const response = await ikasClient.mutations.saveVariantStocks({
      input: {
        stockInputs: [
          {
            productId,
            variantId,
            stockLocationId,
            stockCount,
          },
        ],
      },
    });

    if (!response.isSuccess || !response.data?.saveVariantStocks) {
      return NextResponse.json({ error: 'Failed to update product stock' }, { status: 500 });
    }

    const errors = response.data.saveVariantStocks.errors;
    if (errors && errors.length > 0) {
      console.error('saveVariantStocks returned errors:', errors);
      return NextResponse.json({ error: 'Failed to update product stock', details: errors }, { status: 502 });
    }

    console.log('Product stock updated via ikas webhook:', {
      scope: webhook.scope,
      merchantId: webhook.merchantId,
      productId,
      variantId,
      stockLocationId,
      stockCount,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing ikas webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
