import { getIkas } from '@/helpers/api-helpers';
import type { AuthToken } from '@/models/auth-token';
import { config } from '@/globals/config';

type SeedVariant = {
  id: string;
  name: string;
  sku: string;
  sellPrice: number;
};

type CreatedOrderSummary = {
  id: string;
  orderNumber?: string | null;
  orderedAt?: number | null;
  totalFinalPrice?: number | null;
};

const CREATE_ORDER_MUTATION = `
  mutation createOrderWithTransactions($input: PublicCreateOrderWithTransactionsInput!) {
    createOrderWithTransactions(input: $input) {
      id
      orderNumber
      orderedAt
      totalFinalPrice
      currencyCode
      status
    }
  }
`;

const DAY_MS = 24 * 60 * 60 * 1000;

function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

function lineTotal(price: number, quantity: number): number {
  return Math.round(price * quantity * 100) / 100;
}

/**
 * Mevcut ürün varyantlarından son ~30 güne yayılmış demo siparişleri üretir.
 * Dashboard ciro + satış adedi chart'larını doldurmak için.
 */
export async function seedSalesOrders(
  authToken: AuthToken,
  options?: { orderCount?: number },
): Promise<{ created: CreatedOrderSummary[]; variantCount: number; skippedReason?: string }> {
  const orderCount = options?.orderCount ?? 28;
  const ikas = getIkas(authToken);

  const productsRes = await ikas.queries.listProduct({});
  const products = productsRes.data?.listProduct?.data ?? [];
  const variants: SeedVariant[] = [];

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (!variant?.id) continue;
      const sellPrice = variant.prices?.[0]?.sellPrice;
      if (!sellPrice || sellPrice <= 0) continue;
      variants.push({
        id: variant.id,
        name: product.name,
        sku: variant.sku || variant.id,
        sellPrice,
      });
    }
  }

  if (variants.length === 0) {
    return { created: [], variantCount: 0, skippedReason: 'Satılabilir aktif varyant bulunamadı' };
  }

  // createOrder, app'in salesChannelId'sini kabul etmiyor (app_is_not_a_sales_channel).
  // salesChannelId'yi hiç göndermiyoruz; ikas varsayılan kanalı kullanır.
  const created: CreatedOrderSummary[] = [];
  const now = Date.now();

  for (let i = 0; i < orderCount; i++) {
    const daysAgo = i % 30;
    const hour = 10 + (i % 8);
    const orderedAt = now - daysAgo * DAY_MS - (12 - hour) * 60 * 60 * 1000;

    const primary = pick(variants, i);
    const secondary = pick(variants, i + 3);
    const qty1 = 1 + (i % 3);
    const qty2 = i % 4 === 0 ? 2 : 1;
    const price1 = primary.sellPrice;
    const price2 = secondary.sellPrice;
    const amount = lineTotal(price1, qty1) + (i % 2 === 0 ? lineTotal(price2, qty2) : 0);

    const orderLineItems = [
      {
        price: price1,
        quantity: qty1,
        variant: { id: primary.id, name: primary.name },
      },
      ...(i % 2 === 0
        ? [
            {
              price: price2,
              quantity: qty2,
              variant: { id: secondary.id, name: secondary.name },
            },
          ]
        : []),
    ];

    const input = {
      isTaxFreeOrder: true,
      disableAutoCreateCustomer: false,
      order: {
        currencyCode: 'TRY',
        orderedAt,
        shippingMethod: 'NO_SHIPMENT',
        note: `Flowventory seed #${i + 1}`,
        customer: {
          email: `seed.customer.${(i % 5) + 1}@flowventory.dev`,
          firstName: 'Seed',
          lastName: `Musteri${(i % 5) + 1}`,
        },
        billingAddress: {
          addressLine1: 'Seed Cad. No:1',
          city: { name: 'Istanbul' },
          country: { name: 'Turkey', iso2: 'TR' },
          firstName: 'Seed',
          lastName: `Musteri${(i % 5) + 1}`,
          isDefault: true,
          phone: '+905551112233',
        },
        shippingAddress: {
          addressLine1: 'Seed Cad. No:1',
          city: { name: 'Istanbul' },
          country: { name: 'Turkey', iso2: 'TR' },
          firstName: 'Seed',
          lastName: `Musteri${(i % 5) + 1}`,
          isDefault: true,
          phone: '+905551112233',
        },
        orderLineItems,
      },
      transactions: [{ amount }],
    };

    const response = await fetch(config.graphApiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken.accessToken}`,
      },
      body: JSON.stringify({
        query: CREATE_ORDER_MUTATION,
        variables: { input },
        operationName: 'createOrderWithTransactions',
      }),
    });

    const json = (await response.json()) as {
      data?: { createOrderWithTransactions?: CreatedOrderSummary };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      throw new Error(`Sipariş #${i + 1} hata: ${json.errors.map(e => e.message).join('; ')}`);
    }

    const order = json.data?.createOrderWithTransactions;
    if (order?.id) created.push(order);
  }

  return { created, variantCount: variants.length };
}
