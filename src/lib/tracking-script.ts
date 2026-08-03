import { readFileSync } from 'fs';
import { join } from 'path';
import { getIkas } from '@/helpers/api-helpers';
import { StorefrontJSScriptContentTypeEnum } from '@/lib/ikas-client/generated/graphql';
import { prisma } from '@/lib/prisma';
import { AuthToken } from '@/models/auth-token';

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
 * Authorized app → sales channel → ilk storefront id.
 */
export async function resolveStorefrontId(authToken: AuthToken): Promise<string> {
  const ikasClient = getIkas(authToken);

  const authorizedAppResponse = await ikasClient.queries.getAuthorizedApp();
  if (!authorizedAppResponse.isSuccess || !authorizedAppResponse.data?.getAuthorizedApp) {
    throw new TrackingScriptError(
      'Yetkili uygulama bilgisi alınamadı. Uygulamayı yeniden yüklemeyi deneyin.',
      500,
    );
  }

  const salesChannelId =
    authorizedAppResponse.data.getAuthorizedApp.salesChannelId || authToken.salesChannelId || null;

  if (!salesChannelId) {
    throw new TrackingScriptError(
      'Satış kanalı bulunamadı. Uygulamayı App Store’dan kaldırıp yeniden kurun.',
      404,
    );
  }

  const storefrontResponse = await ikasClient.queries.listStorefront({
    salesChannelId: { eq: salesChannelId },
  });

  if (!storefrontResponse.isSuccess || !storefrontResponse.data?.listStorefront?.length) {
    throw new TrackingScriptError(
      'Storefront bulunamadı. Mağazada aktif bir vitrin olduğundan emin olun.',
      404,
    );
  }

  return storefrontResponse.data.listStorefront[0].id;
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
          isHighPriority: false,
        },
      });

      if (!created.isSuccess || !created.data?.createStorefrontJSScript?.id) {
        console.error('createStorefrontJSScript failed after update miss', {
          errors: created.errors,
        });
        throw new TrackingScriptError(
          'Takip scripti kaydedilemedi. Vitrin JS script izninizi kontrol edin.',
          500,
        );
      }

      scriptId = created.data.createStorefrontJSScript.id;
      updated = false;
    } else {
      scriptId = result.data.updateStorefrontJSScript.id!;
      updated = true;
    }
  } else {
    const created = await ikasClient.mutations.createStorefrontJSScript({
      input: {
        contentType: StorefrontJSScriptContentTypeEnum.SCRIPT,
        name: TRACKING_SCRIPT_NAME,
        scriptContent,
        storefrontId,
        isHighPriority: false,
      },
    });

    if (!created.isSuccess || !created.data?.createStorefrontJSScript?.id) {
      console.error('createStorefrontJSScript failed', { errors: created.errors });
      throw new TrackingScriptError(
        'Takip scripti kaydedilemedi. Vitrin JS script izninizi kontrol edin.',
        500,
      );
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
