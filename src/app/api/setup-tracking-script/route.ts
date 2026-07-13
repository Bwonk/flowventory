import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { StorefrontJSScriptContentTypeEnum } from '@/lib/ikas-client/generated/graphql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });
    }

    const deployUrl = process.env.NEXT_PUBLIC_DEPLOY_URL || request.nextUrl.origin;

    const trackerPath = join(process.cwd(), 'public', 'tracker.js');
    const rawScript = readFileSync(trackerPath, 'utf-8');
    const scriptContent = rawScript.replace(
      /var API_URL = '.*?'/,
      `var API_URL = '${deployUrl}'`,
    );

    const ikasClient = getIkas(authToken);

    const authorizedAppResponse = await ikasClient.queries.getAuthorizedApp();
    if (!authorizedAppResponse.isSuccess || !authorizedAppResponse.data?.getAuthorizedApp) {
      return NextResponse.json({ error: 'Failed to get authorized app' }, { status: 500 });
    }

    const salesChannelId = authorizedAppResponse.data.getAuthorizedApp.salesChannelId;
    if (!salesChannelId) {
      return NextResponse.json({ error: 'Sales channel not found' }, { status: 404 });
    }

    const storefrontResponse = await ikasClient.queries.listStorefront({
      salesChannelId: { eq: salesChannelId },
    });

    if (!storefrontResponse.isSuccess || !storefrontResponse.data?.listStorefront?.length) {
      return NextResponse.json({ error: 'Storefront not found' }, { status: 404 });
    }

    const storefrontId = storefrontResponse.data.listStorefront[0].id;

    const result = await ikasClient.mutations.createStorefrontJSScript({
      input: {
        contentType: StorefrontJSScriptContentTypeEnum.SCRIPT,
        name: 'flowventory-product-view-tracking',
        scriptContent,
        storefrontId,
        isHighPriority: false,
      },
    });

    if (!result.isSuccess || !result.data?.createStorefrontJSScript) {
      return NextResponse.json({ error: 'Failed to save tracking script' }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        scriptId: result.data.createStorefrontJSScript.id,
        storefrontId,
        message: 'Tracking script installed successfully',
      },
    });
  } catch (error) {
    console.error('Setup tracking script error:', error);
    return NextResponse.json({ error: 'Failed to setup tracking script' }, { status: 500 });
  }
}
