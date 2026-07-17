import axios from 'axios';
import { GetMerchantApiResponse } from '../app/api/ikas/get-merchant/route';
import { GetOrderApiResponse } from '../app/api/ikas/get-order/route';
import { ApiResponseType } from '../globals/constants';
import { ListProductsApiResponse } from '../app/api/ikas/list-products/route';
import { AnalyticsApiResponse } from '../app/api/ikas/analytics/route';
import { HourlyAnalyticsApiResponse } from '../app/api/ikas/analytics/hourly/route';
import { DailyViewStatsResponse, ViewStatsApiResponse, HourlyViewStatsResponse } from '../app/api/product-view/stats/route';

export async function makePostRequest<T>({ url, data, token }: { url: string; data?: any; token?: string }) {
  return axios.post<ApiResponseType<T>>(url, data, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makeGetRequest<T>({ url, data, token }: { url: string; data?: any; token?: string }) {
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
    getOrder: (token: string, orderId: string) => makeGetRequest<GetOrderApiResponse>({ url: '/api/ikas/get-order', token, data: { orderId } }),
    listProducts: (token: string) => makeGetRequest<ListProductsApiResponse>({ url: '/api/ikas/list-products', token }),
    getAnalytics: (token: string) => makeGetRequest<AnalyticsApiResponse>({ url: '/api/ikas/analytics', token }),
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
    getHourlyViewStats: (token: string, date?: string) =>
      makeGetRequest<HourlyViewStatsResponse>({
        url: '/api/product-view/stats',
        token,
        data: { hourly: 'true', ...(date ? { date } : {}) },
      }),
  },
};
