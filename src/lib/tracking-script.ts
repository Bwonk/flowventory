import { readFileSync } from 'fs';
import { join } from 'path';
import { getIkas } from '@/helpers/api-helpers';
import { StorefrontJSScriptContentTypeEnum } from '@/lib/ikas-client/generated/graphql';
import { prisma } from '@/lib/prisma';
import { AuthToken } from '@/models/auth-token';
import { AuthTokenManager } from '@/models/auth-token/manager';

export const TRACKING_SCRIPT_NAME = 'flowventory-product-view-tracking';

export type TrackingScriptStatus = {
  installed: boolean;
  scriptId?: string;
  storefrontId?: string;
  apiUrl?: string;
  updatedAt?: string;
  installedAt?: string;
};

export type TrackingScriptInstallResult = {
  scriptId: string;
  storefrontId: string;
  apiUrl: string;
  updated: boolean;
  message: string;
};

/**
 * tracker.js'i okuyup API_URL + MERCHANT_ID placeholder'larını doldurur.
 */
export function buildTrackerScript(apiUrl: string, merchantId: string): string {
  const trackerPath = join(process.cwd(), 'public', 'tracker.js');
  const rawScript = readFileSync(trackerPath, 'utf-8');
  return rawScript
    .replace(/var API_URL = '.*?'/, `var API_URL = '${apiUrl}'`)
    .replace(/var MERCHANT_ID = '.*?'/, `var MERCHANT_ID = '${merchantId}'`);
}

/**
 * Storefront id çözümlemesi.
 * Sıra: AuthToken / getAuthorizedApp salesChannelId → getSalesChannel →
 * listStorefront (filtreli veya filtresiz).
 */
export async function resolveStorefrontId(authToken: AuthToken): Promise<string> {
  const ikasClient = getIkas(authToken);

  let salesChannelId: string | null = authToken.salesChannelId || null;

  try {
    const authorizedAppResponse = await ikasClient.queries.getAuthorizedApp();
    if (authorizedAppResponse.isSuccess && authorizedAppResponse.data?.getAuthorizedApp) {
      salesChannelId =
        authorizedAppResponse.data.getAuthorizedApp.salesChannelId || salesChannelId;
    }
  } catch (error) {
    console.warn('getAuthorizedApp failed while resolving storefront', error);
  }

  // App'e salesChannel bağlı değilse merchant'ın storefront kanalını dene.
  if (!salesChannelId) {
    try {
      const salesChannelResponse = await ikasClient.queries.getSalesChannel();
      const channel = salesChannelResponse.data?.getSalesChannel;
      if (salesChannelResponse.isSuccess && channel?.id) {
        const type = String(channel.type).toUpperCase();
        if (type === 'STOREFRONT' || type === 'STOREFRONT_APP' || type === 'B2B_STOREFRONT') {
          salesChannelId = channel.id;
        } else {
          // Tip uygun olmasa bile tek kanal buysa yine kullan.
          salesChannelId = channel.id;
        }
      }
    } catch (error) {
      console.warn('getSalesChannel failed while resolving storefront', error);
    }
  }

  const storefrontResponse = salesChannelId
    ? await ikasClient.queries.listStorefront({ salesChannelId: { eq: salesChannelId } })
    : await ikasClient.queries.listStorefront({});

  const storefronts = storefrontResponse.data?.listStorefront ?? [];

  if (!storefrontResponse.isSuccess || storefronts.length === 0) {
    throw new TrackingScriptError(
      'Storefront bulunamadı. Mağazada aktif bir vitrin olduğundan emin olun.',
      404,
    );
  }

  const preferred =
    storefronts.find((sf) => String(sf.type).toUpperCase() === 'STOREFRONT') ?? storefronts[0];

  const resolvedSalesChannelId = preferred.salesChannelId || salesChannelId;
  if (resolvedSalesChannelId && resolvedSalesChannelId !== authToken.salesChannelId) {
    try {
      await AuthTokenManager.put({
        ...authToken,
        salesChannelId: resolvedSalesChannelId,
      });
      authToken.salesChannelId = resolvedSalesChannelId;
    } catch (error) {
      console.warn('Failed to backfill salesChannelId on AuthToken', error);
    }
  }

  return preferred.id;
}

function formatIkasMutationError(errors: unknown): string {
  try {
    const list = Array.isArray(errors) ? errors : [];
    for (const err of list) {
      const extensions = (err as { extensions?: Record<string, unknown> })?.extensions;
      const exception = extensions?.exception as
        | { response?: { message?: string | string[] } }
        | undefined;
      const msg = exception?.response?.message;
      if (Array.isArray(msg) && msg.length) return msg.join('; ');
      if (typeof msg === 'string' && msg) return msg;

      const validation = extensions?.validationErrors;
      if (validation) return JSON.stringify(validation);

      const message = (err as { message?: string })?.message;
      if (message) return message;
    }
    return JSON.stringify(errors);
  } catch {
    return 'Bilinmeyen ikas hatası';
  }
}

function throwCreateScriptError(errors: unknown): never {
  const detail = formatIkasMutationError(errors);
  console.error('createStorefrontJSScript failed', detail);

  const lower = detail.toLowerCase();
  if (lower.includes('saleschannel') || lower.includes('sales channel') || lower.includes('storefront')) {
    throw new TrackingScriptError(
      'Vitrin/satış kanalı doğrulanamadı. Partners panelinde uygulamaya satış kanalı bağlayın, sonra tekrar deneyin.',
      500,
    );
  }

  throw new TrackingScriptError(
    `Takip scripti kaydedilemedi: ${detail}`,
    500,
  );
}

export async function getTrackingScriptStatus(merchantId: string): Promise<TrackingScriptStatus> {
  const row = await prisma.trackingScriptInstall.findUnique({
    where: { merchantId },
  });

  if (!row) {
    return { installed: false };
  }

  return {
    installed: true,
    scriptId: row.scriptId,
    storefrontId: row.storefrontId,
    apiUrl: row.apiUrl,
    updatedAt: row.updatedAt.toISOString(),
    installedAt: row.installedAt.toISOString(),
  };
}

/**
 * DB'de scriptId varsa update, yoksa create. Sonra TrackingScriptInstall upsert.
 */
export async function installOrUpdateTrackingScript(params: {
  merchantId: string;
  authToken: AuthToken;
  apiUrl: string;
}): Promise<TrackingScriptInstallResult> {
  const { merchantId, authToken, apiUrl } = params;
  const scriptContent = buildTrackerScript(apiUrl, merchantId);
  const storefrontId = await resolveStorefrontId(authToken);
  const ikasClient = getIkas(authToken);

  const existing = await prisma.trackingScriptInstall.findUnique({
    where: { merchantId },
  });

  let scriptId: string;
  let updated: boolean;

  if (existing?.scriptId) {
    const result = await ikasClient.mutations.updateStorefrontJSScript({
      input: {
        id: existing.scriptId,
        name: TRACKING_SCRIPT_NAME,
        scriptContent,
        storefrontId,
        contentType: StorefrontJSScriptContentTypeEnum.SCRIPT,
        isHighPriority: false,
      },
    });

    if (!result.isSuccess || !result.data?.updateStorefrontJSScript) {
      // Kayıtlı id ikas'ta yoksa (silinmiş olabilir) create'e düş.
      console.warn('updateStorefrontJSScript failed, falling back to create', {
        errors: result.errors,
        scriptId: existing.scriptId,
      });
      const created = await ikasClient.mutations.createStorefrontJSScript({
        input: {
          contentType: StorefrontJSScriptContentTypeEnum.SCRIPT,
          name: TRACKING_SCRIPT_NAME,
          scriptContent,
          storefrontId,
        },
      });

      if (!created.isSuccess || !created.data?.createStorefrontJSScript?.id) {
        throwCreateScriptError(created.errors);
      }

      scriptId = created.data.createStorefrontJSScript.id;
      updated = false;
    } else {
      scriptId = result.data.updateStorefrontJSScript.id!;
      updated = true;
    }
  } else {
    console.info('Installing tracking script', {
      storefrontId,
      salesChannelId: authToken.salesChannelId,
      apiUrl,
      scriptLength: scriptContent.length,
    });

    const created = await ikasClient.mutations.createStorefrontJSScript({
      input: {
        contentType: StorefrontJSScriptContentTypeEnum.SCRIPT,
        name: TRACKING_SCRIPT_NAME,
        scriptContent,
        storefrontId,
      },
    });

    if (!created.isSuccess || !created.data?.createStorefrontJSScript?.id) {
      throwCreateScriptError(created.errors);
    }

    scriptId = created.data.createStorefrontJSScript.id;
    updated = false;
  }

  await prisma.trackingScriptInstall.upsert({
    where: { merchantId },
    create: {
      merchantId,
      storefrontId,
      scriptId,
      apiUrl,
    },
    update: {
      storefrontId,
      scriptId,
      apiUrl,
    },
  });

  return {
    scriptId,
    storefrontId,
    apiUrl,
    updated,
    message: updated
      ? 'Tracking script updated successfully'
      : 'Tracking script installed successfully',
  };
}

export class TrackingScriptError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TrackingScriptError';
    this.status = status;
  }
}
