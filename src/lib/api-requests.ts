import axios from 'axios';
import type { StockHistoryApiResponse } from '@/app/api/stock-history/route';
import type { RulesApiResponse, TrackingRuleItem } from '@/app/api/rules/route';
import type { RuleDetailApiResponse } from '@/app/api/rules/[id]/route';
import type { ProductOptionsApiResponse } from '@/app/api/products/options/route';
import type { RuleInput } from '@/lib/rules/schema';
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
import { QuickStockApiResponse } from '../app/api/ikas/quick-stock/route';
import { AssignVendorApiResponse } from '../app/api/ikas/assign-vendor/route';
import { VendorsApiResponse, VendorListItem, DeleteVendorApiResponse } from '../app/api/vendors/route';
import { SendVendorReportApiResponse } from '../app/api/vendors/send-report/route';
import { SyncApiResponse } from '../app/api/sync/route';
import { DigestTestApiResponse } from '../app/api/digest/test/route';

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

export async function makeDeleteRequest<T>({ url, data, token }: { url: string; data?: Record<string, unknown>; token?: string }) {
  return axios.delete<ApiResponseType<T>>(url, {
    data,
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
    quickStock: (token: string, input: { productId: string; variantId: string; addQty: number }) =>
      makePostRequest<QuickStockApiResponse>({ url: '/api/ikas/quick-stock', token, data: input }),
    assignVendor: (
      token: string,
      input: { vendorName: string } & ({ productId: string } | { productIds: string[] }),
    ) => makePostRequest<AssignVendorApiResponse>({ url: '/api/ikas/assign-vendor', token, data: input }),
    getHourlyAnalytics: (token: string, date?: string) =>
      makeGetRequest<HourlyAnalyticsApiResponse>({
        url: '/api/ikas/analytics/hourly',
        token,
        data: date ? { date } : undefined,
      }),
  },
  stockHistory: {
    /** Ürün (ya da varyant) için geçmiş stok serisi + projeksiyon + 30/90 gün değişim. */
    get: (token: string, params: { productId: string; variantId?: string; days: 30 | 90 }) =>
      makeGetRequest<StockHistoryApiResponse>({ url: '/api/stock-history', token, data: params }),
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
    inventory: (token: string, window?: 30 | 60) =>
      makeGetRequest<InventoryInsightApiResponse>({
        url: '/api/insights/inventory',
        token,
        data: window ? { window: String(window) } : undefined,
      }),
  },
  notifications: {
    list: (token: string) =>
      makeGetRequest<NotificationsApiResponse>({ url: '/api/notifications', token }),
    /** ids yoksa tümü okundu; read=false yalnız belirli id'lerle (okunmadı işaretle). */
    markRead: (token: string, ids?: string[], read = true) =>
      makePostRequest<{ ok: boolean }>({
        url: '/api/notifications',
        token,
        data: { ...(ids ? { ids } : {}), read },
      }),
    /** Soft delete — listeden kaldırır, kayıt dedupe için kalır. */
    dismiss: (token: string, ids: string[]) =>
      makeDeleteRequest<{ ok: boolean }>({ url: '/api/notifications', token, data: { ids } }),
  },
  vendors: {
    list: (token: string) => makeGetRequest<VendorsApiResponse>({ url: '/api/vendors', token }),
    create: (token: string, input: { vendorName: string; email: string | null; phone: string | null }) =>
      makePostRequest<VendorListItem>({ url: '/api/vendors', token, data: input }),
    updateContact: (
      token: string,
      input: { vendorId: string; vendorName: string; email: string | null; phone: string | null },
    ) => makePutRequest<VendorListItem>({ url: '/api/vendors', token, data: input }),
    sendReport: (token: string, input: { vendorId: string; lines?: { variantId: string; qty: number }[] }) =>
      makePostRequest<SendVendorReportApiResponse>({ url: '/api/vendors/send-report', token, data: input }),
    delete: (token: string, input: { vendorId: string }) =>
      makeDeleteRequest<DeleteVendorApiResponse>({ url: '/api/vendors', token, data: input }),
  },
  rules: {
    list: (token: string) => makeGetRequest<RulesApiResponse>({ url: '/api/rules', token }),
    get: (token: string, id: string) =>
      makeGetRequest<RuleDetailApiResponse>({ url: `/api/rules/${encodeURIComponent(id)}`, token }),
    create: (token: string, input: RuleInput) =>
      makePostRequest<TrackingRuleItem>({ url: '/api/rules', token, data: input }),
    update: (token: string, id: string, input: RuleInput | { enabled: boolean }) =>
      makePutRequest<TrackingRuleItem>({ url: `/api/rules/${encodeURIComponent(id)}`, token, data: input }),
    delete: (token: string, id: string) =>
      makeDeleteRequest<{ ok: boolean }>({ url: `/api/rules/${encodeURIComponent(id)}`, token }),
  },
  products: {
    /** Seçiciler için hafif ürün listesi (snapshot). */
    options: (token: string) => makeGetRequest<ProductOptionsApiResponse>({ url: '/api/products/options', token }),
  },
  sync: {
    run: (token: string) => makePostRequest<SyncApiResponse>({ url: '/api/sync', token }),
  },
  digest: {
    sendTest: (token: string, input: { frequency: 'daily' | 'weekly' }) =>
      makePostRequest<DigestTestApiResponse>({ url: '/api/digest/test', token, data: input }),
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
