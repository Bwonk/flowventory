import { BaseGraphQLAPIClient, BaseGraphQLAPIClientOptions, APIResult } from '@ikas/admin-api-client';

export type DateFilterInput = {
  eq?: number;
  gt?: number;
  gte?: number;
  in?: Array<number>;
  lt?: number;
  lte?: number;
  ne?: number;
  nin?: Array<number>;
}

export type SaveVariantStockInput = {
  deleted?: boolean;
  productId: string;
  stockCount: number;
  stockLocationId: string;
  variantId: string;
}

export type SaveVariantStocksInput = {
  stockInputs?: Array<SaveVariantStockInput>;
}

export type StringFilterInput = {
  eq?: string;
  in?: Array<string>;
  ne?: string;
  nin?: Array<string>;
}

export type GetMerchantQueryVariables = {}

export type GetMerchantQueryData = {
  id: string;
  email: string;
  storeName?: string;
}

export interface GetMerchantQuery {
  getMerchant: GetMerchantQueryData;
}

export type GetAuthorizedAppQueryVariables = {}

export type GetAuthorizedAppQueryData = {
  id: string;
  salesChannelId?: string;
}

export interface GetAuthorizedAppQuery {
  getAuthorizedApp: GetAuthorizedAppQueryData;
}

export type ListOrderQueryVariables = {
  id?: StringFilterInput;
}

export type ListOrderQueryData = {
  data: Array<{
  id: string;
  orderNumber?: string;
  orderedAt?: number;
  status: OrderStatusEnum;
  orderPaymentStatus?: OrderPaymentStatusEnum;
  orderPackageStatus?: OrderPackageStatusEnum;
  totalFinalPrice: number;
  currencyCode: string;
  customer?: {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  fullName?: string;
};
  billingAddress?: {
  firstName: string;
  lastName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: {
  name: string;
};
  state?: {
  name?: string;
};
  country: {
  name: string;
};
  postalCode?: string;
};
  shippingAddress?: {
  firstName: string;
  lastName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: {
  name: string;
};
  state?: {
  name?: string;
};
  country: {
  name: string;
};
  postalCode?: string;
};
  orderLineItems: Array<{
  id: string;
  quantity: number;
  finalPrice?: number;
  variant: {
  id?: string;
  name: string;
  sku?: string;
};
}>;
}>;
}

export interface ListOrderQuery {
  listOrder: ListOrderQueryData;
}

export type ListProductQueryVariables = {}

export type ListProductQueryData = {
  data: Array<{
  id: string;
  name: string;
  categories?: Array<{
  id: string;
  name: string;
}>;
  variants: Array<{
  id: string;
  sku?: string;
  images?: Array<{
  imageId?: string;
  fileName?: string;
  isMain: boolean;
  order: number;
  isVideo?: boolean;
}>;
  variantValues?: Array<{
  variantTypeName: string;
  variantValueName: string;
}>;
  stocks?: Array<{
  stockCount: number;
  stockLocationId: string;
}>;
  prices: Array<{
  sellPrice: number;
}>;
}>;
}>;
}

export interface ListProductQuery {
  listProduct: ListProductQueryData;
}

export type SaveVariantStocksMutationVariables = {
  input: SaveVariantStocksInput;
}

export type SaveVariantStocksMutationData = {
  errors?: Array<{
  errorCode: string;
  inputArrayIndex: number;
  inputData: {
  productId: string;
  variantId: string;
};
}>;
}

export interface SaveVariantStocksMutation {
  saveVariantStocks: SaveVariantStocksMutationData;
}

export type ListOrderForAnalyticsQueryVariables = {
  orderedAt?: DateFilterInput;
}

export type ListOrderForAnalyticsQueryData = {
  data: Array<{
  id: string;
  orderedAt?: number;
  status: OrderStatusEnum;
  totalFinalPrice: number;
  currencyCode: string;
  orderLineItems: Array<{
  quantity: number;
  finalPrice?: number;
  variant: {
  id?: string;
  sku?: string;
};
}>;
}>;
}

export interface ListOrderForAnalyticsQuery {
  listOrder: ListOrderForAnalyticsQueryData;
}

export class GeneratedQueries {
  client: BaseGraphQLAPIClient<any>;

  constructor(client: BaseGraphQLAPIClient<any>) {
    this.client = client;
  }

  async getMerchant(): Promise<APIResult<Partial<GetMerchantQuery>>> {
    const query = `
  query getMerchant {
    getMerchant {
      id
      email
      storeName
    }
  }
`;
    return this.client.query<Partial<GetMerchantQuery>>({ query });
  }

  async getAuthorizedApp(): Promise<APIResult<Partial<GetAuthorizedAppQuery>>> {
    const query = `
  query getAuthorizedApp {
    getAuthorizedApp {
      id
      salesChannelId
    }
  }
`;
    return this.client.query<Partial<GetAuthorizedAppQuery>>({ query });
  }

  async listOrder(variables: ListOrderQueryVariables): Promise<APIResult<Partial<ListOrderQuery>>> {
    const query = `
  query listOrder($id: StringFilterInput) {
    listOrder(id: $id) {
      data {
        id
        orderNumber
        orderedAt
        status
        orderPaymentStatus
        orderPackageStatus
        totalFinalPrice
        currencyCode
        customer {
          id
          firstName
          lastName
          email
          phone
          fullName
        }
        billingAddress {
          firstName
          lastName
          phone
          addressLine1
          addressLine2
          city {
            name
          }
          state {
            name
          }
          country {
            name
          }
          postalCode
        }
        shippingAddress {
          firstName
          lastName
          phone
          addressLine1
          addressLine2
          city {
            name
          }
          state {
            name
          }
          country {
            name
          }
          postalCode
        }
        orderLineItems {
          id
          quantity
          finalPrice
          variant {
            id
            name
            sku
          }
        }
      }
    }
  }
`;
    return this.client.query<Partial<ListOrderQuery>>({ query, variables });
  }

  async listProduct(): Promise<APIResult<Partial<ListProductQuery>>> {
    const query = `
  query listProduct {
    listProduct {
      data {
        id
        name
        categories {
          id
          name
        }
        variants {
          id
          sku
          images {
            imageId
            fileName
            isMain
            order
            isVideo
          }
          variantValues {
            variantTypeName
            variantValueName
          }
          stocks {
            stockCount
            stockLocationId
          }
          prices {
            sellPrice
          }
        }
      }
    }
  }
`;
    return this.client.query<Partial<ListProductQuery>>({ query });
  }

  async listOrderForAnalytics(variables: ListOrderForAnalyticsQueryVariables): Promise<APIResult<Partial<ListOrderForAnalyticsQuery>>> {
    const query = `
  query listOrderForAnalytics($orderedAt: DateFilterInput) {
    listOrder(orderedAt: $orderedAt) {
      data {
        id
        orderedAt
        status
        totalFinalPrice
        currencyCode
        orderLineItems {
          quantity
          finalPrice
          variant {
            id
            sku
          }
        }
      }
    }
  }
`;
    return this.client.query<Partial<ListOrderForAnalyticsQuery>>({ query, variables });
  }
}

export class GeneratedMutations {
  client: BaseGraphQLAPIClient<any>;

  constructor(client: BaseGraphQLAPIClient<any>) {
    this.client = client;
  }

  async saveVariantStocks(variables: SaveVariantStocksMutationVariables): Promise<APIResult<Partial<SaveVariantStocksMutation>>> {
    const mutation = `
  mutation saveVariantStocks($input: SaveVariantStocksInput!) {
    saveVariantStocks(input: $input) {
      errors {
        errorCode
        inputArrayIndex
        inputData {
          productId
          variantId
        }
      }
    }
  }
`;
    return this.client.mutate<Partial<SaveVariantStocksMutation>>({ mutation, variables });
  }
}

export class ikasAdminGraphQLAPIClient<TokenData> extends BaseGraphQLAPIClient<TokenData> {
  queries: GeneratedQueries;
  mutations: GeneratedMutations;

  constructor(options: BaseGraphQLAPIClientOptions<TokenData>) {
    super(options);
    this.queries = new GeneratedQueries(this);
    this.mutations = new GeneratedMutations(this);
  }
}
