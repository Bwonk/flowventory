import axios from 'axios';
import { GetMerchantApiResponse } from '../app/api/ikas/get-merchant/route';
import { ApiResponseType } from '../globals/constants';
import { ListProductsApiResponse } from '../app/api/ikas/list-products/route';
import { AnalyticsApiResponse } from '../app/api/ikas/analytics/route';
import { HourlyAnalyticsApiResponse } from '../app/api/ikas/analytics/hourly/route';
import { DailyViewStatsResponse, ViewStatsApiResponse, HourlyViewStatsResponse } from '../app/api/product-view/stats/route';
import { TrackingScriptStatusApiResponse } from '../app/api/tracking-script/status/route';
import { TrackingScriptInstallApiResponse } from '../app/api/tracking-script/install/route';
import { MerchantSettingsApiResponse } from '../app/api/merchant-settings/route';
import { PurchaseReportApiResponse } from '../app/api/reports/purchase/route';
import { ConversionInsightApiResponse } from '../app/api/insights/conversion/route';
import { InventoryInsightApiResponse } from '../app/api/insights/inventory/route';
import { NotificationsApiResponse } from '../app/api/notifications/route';

export async function makePostRequest<T>({ url, data, token }: { url: string; data?: Record<string, unknown>; token?: string }) {
  return axios.post<ApiResponseType<T>>(url, data, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makePutRequest<T>({ url, data, token }: { url: string; data?: Record<string, unknown>; token?: string }) {
  return axios.put<ApiResponseType<T>>(url, data, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makeGetRequest<T>({ url, data, token }: { url: string; data?: Record<string, unknown>; token?: string }) {
  return axios.get<ApiResponseType<T>>(url, {
    params: data,
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

// API requests object - frontend-backend bridge
export const ApiRequests = {
  ikas: {
    getMerchant: (token: string) => makeGetRequest<GetMerchantApiResponse>({ url: '/api/ikas/get-merchant', token }),
    listProducts: (token: string) => makeGetRequest<ListProductsApiResponse>({ url: '/api/ikas/list-products', token }),
    getAnalytics: (token: string) => makeGetRequest<AnalyticsApiResponse>({ url: '/api/ikas/analytics', token }),
    updateStock: (
      token: string,
      input: { productId: string; variantId: string; stockLocationId: string; stockCount: number },
    ) => makePostRequest<{ ok: boolean }>({ url: '/api/ikas/update-stock', token, data: input }),
    getHourlyAnalytics: (token: string, date?: string) =>
      makeGetRequest<HourlyAnalyticsApiResponse>({
        url: '/api/ikas/analytics/hourly',
        token,
        data: date ? { date } : undefined,
      }),
  },
  productView: {
    getViewStats: (token: string, productId?: string) =>
      makeGetRequest<ViewStatsApiResponse>({
        url: '/api/product-view/stats',
        token,
        data: { productId },
      }),
    getDailyViewStats: (token: string) =>
      makeGetRequest<DailyViewStatsResponse>({
        url: '/api/product-view/stats',
        token,
        data: { daily: 'true' },
      }),
    getHourlyViewStats: (token: string, date?: string, productId?: string) =>
      makeGetRequest<HourlyViewStatsResponse>({
        url: '/api/product-view/stats',
        token,
        data: {
          hourly: 'true',
          ...(date ? { date } : {}),
          ...(productId ? { productId } : {}),
        },
      }),
  },
  reports: {
    purchase: (token: string) =>
      makeGetRequest<PurchaseReportApiResponse>({ url: '/api/reports/purchase', token }),
  },
  insights: {
    conversion: (token: string) =>
      makeGetRequest<ConversionInsightApiResponse>({ url: '/api/insights/conversion', token }),
    inventory: (token: string) =>
      makeGetRequest<InventoryInsightApiResponse>({ url: '/api/insights/inventory', token }),
  },
  notifications: {
    list: (token: string) =>
      makeGetRequest<NotificationsApiResponse>({ url: '/api/notifications', token }),
    markRead: (token: string, ids?: string[]) =>
      makePostRequest<{ ok: boolean }>({ url: '/api/notifications', token, data: ids ? { ids } : {} }),
  },
  merchantSettings: {
    get: (token: string) =>
      makeGetRequest<MerchantSettingsApiResponse>({ url: '/api/merchant-settings', token }),
    update: (token: string, settings: Partial<MerchantSettingsApiResponse>) =>
      makePutRequest<MerchantSettingsApiResponse>({ url: '/api/merchant-settings', token, data: settings }),
  },
  trackingScript: {
    getStatus: (token: string) =>
      makeGetRequest<TrackingScriptStatusApiResponse>({
        url: '/api/tracking-script/status',
        token,
      }),
    install: (token: string) =>
      makePostRequest<TrackingScriptInstallApiResponse>({
        url: '/api/tracking-script/install',
        token,
      }),
  },
};
