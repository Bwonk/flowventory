import { BaseGraphQLAPIClient, BaseGraphQLAPIClientOptions, APIResult } from '@ikas/admin-api-client';

export enum ProductTypeEnum {
  BUNDLE = "BUNDLE",
  DIGITAL = "DIGITAL",
  MEMBERSHIP = "MEMBERSHIP",
  PHYSICAL = "PHYSICAL",
  SUBSCRIPTION = "SUBSCRIPTION"
}

export enum ProductUnitTypeEnum {
  CENTILITER = "CENTILITER",
  CENTIMETER = "CENTIMETER",
  CUBIC_METERS = "CUBIC_METERS",
  CUSTOM = "CUSTOM",
  GRAM = "GRAM",
  KILOGRAM = "KILOGRAM",
  LITER = "LITER",
  METER = "METER",
  MILLIGRAM = "MILLIGRAM",
  MILLILITER = "MILLILITER",
  MILLIMETER = "MILLIMETER",
  SQUARE_METERS = "SQUARE_METERS"
}

export enum SalesChannelStatusEnum {
  HIDDEN = "HIDDEN",
  PASSIVE = "PASSIVE",
  VISIBLE = "VISIBLE"
}

export enum SalesChannelTypeEnum {
  ADMIN = "ADMIN",
  APP = "APP",
  B2B_STOREFRONT = "B2B_STOREFRONT",
  FACEBOOK = "FACEBOOK",
  FIRSAT = "FIRSAT",
  GOOGLE = "GOOGLE",
  POS = "POS",
  STOREFRONT = "STOREFRONT",
  STOREFRONT_APP = "STOREFRONT_APP"
}

export enum StorefrontJSScriptContentTypeEnum {
  FILE = "FILE",
  SCRIPT = "SCRIPT"
}

export type CreateStorefrontJSScriptInput = {
  contentType: StorefrontJSScriptContentTypeEnum;
  fileName?: string;
  isHighPriority?: boolean;
  name: string;
  scriptContent: string;
  storefrontId: string;
}

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

export type HTMLMetaDataTranslationInput = {
  description?: string;
  locale: string;
  pageTitle?: string;
  slug?: string;
}

export type PaginationInput = {
  limit?: number;
  page?: number;
}

export type ProductBaseUnitInput = {
  baseAmount: number;
  type: ProductUnitTypeEnum;
  unitName?: string;
}

export type ProductCategoryInput = {
  name: string;
  path?: Array<string>;
}

export type ProductProductBrandInput = {
  description?: string;
  name: string;
}

export type ProductProductTagsInput = {
  name: string;
}

export type ProductSalesChannelInput = {
  id: string;
  maxQuantityPerCart?: number;
  minQuantityPerCart?: number;
  productVolumeDiscountId?: string;
  quantitySettings?: Array<number>;
  status: SalesChannelStatusEnum;
}

export type ProductTranslationInput = {
  description?: string;
  locale: string;
  name?: string;
}

export type ProductVariantPriceInput = {
  buyPrice?: number;
  currency?: string;
  discountPrice?: number;
  priceListId?: string;
  sellPrice: number;
}

export type ProductVariantUnitModelInput = {
  amount: number;
  type: ProductUnitTypeEnum;
}

export type ProductVendorInput = {
  description?: string;
  name: string;
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

export type UpdateHTMLMetaDataInput = {
  canonicals?: Array<string>;
  description?: string;
  disableIndex?: boolean;
  pageTitle?: string;
  slug?: string;
  translations?: Array<HTMLMetaDataTranslationInput>;
}

export type UpdateProductInput = {
  baseUnit?: ProductBaseUnitInput;
  brand?: ProductProductBrandInput;
  categories?: Array<ProductCategoryInput>;
  description?: string;
  dynamicPriceListIds?: Array<string>;
  googleTaxonomyId?: string;
  groupVariantsByVariantTypeName?: string;
  id: string;
  metaData?: UpdateHTMLMetaDataInput;
  name?: string;
  productOptionSetId?: string;
  salesChannels?: Array<ProductSalesChannelInput>;
  tags?: Array<ProductProductTagsInput>;
  translations?: Array<ProductTranslationInput>;
  type?: ProductTypeEnum;
  variants?: Array<UpdateProductVariantInput>;
  vendor?: ProductVendorInput;
  weight?: number;
}

export type UpdateProductVariantImageInput = {
  fileName?: string;
  imageId: string;
  isMain: boolean;
  isVideo?: boolean;
  order: number;
}

export type UpdateProductVariantInput = {
  barcodeList?: Array<string>;
  hsCode?: string;
  id: string;
  images?: Array<UpdateProductVariantImageInput>;
  isActive?: boolean;
  prices?: Array<ProductVariantPriceInput>;
  sellIfOutOfStock?: boolean;
  sku?: string;
  unit?: ProductVariantUnitModelInput;
  weight?: number;
}

export type UpdateStorefrontJSScriptInput = {
  contentType?: StorefrontJSScriptContentTypeEnum;
  fileName?: string;
  id: string;
  isHighPriority?: boolean;
  name?: string;
  scriptContent?: string;
  storefrontId?: string;
}

export type WebhookInput = {
  endpoint: string;
  salesChannelIds?: Array<string>;
  scopes: Array<string>;
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

export type GetSalesChannelQueryVariables = {}

export type GetSalesChannelQueryData = {
  id: string;
  name: string;
  type: SalesChannelTypeEnum;
}

export interface GetSalesChannelQuery {
  getSalesChannel: GetSalesChannelQueryData;
}

export type ListProductQueryVariables = {
  pagination?: PaginationInput;
  id?: StringFilterInput;
}

export type ListProductQueryData = {
  count: number;
  hasNext: boolean;
  page: number;
  limit: number;
  data: Array<{
  id: string;
  name: string;
  categories?: Array<{
  id: string;
  name: string;
}>;
  vendor?: {
  id: string;
  name: string;
};
  brand?: {
  id: string;
  name: string;
};
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
  buyPrice?: number;
  currencyCode?: string;
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

export type UpdateProductMutationVariables = {
  input: UpdateProductInput;
}

export type UpdateProductMutationData = {
  id: string;
  vendor?: {
  id: string;
  name: string;
};
}

export interface UpdateProductMutation {
  updateProduct: UpdateProductMutationData;
}

export type ListStorefrontQueryVariables = {
  salesChannelId?: StringFilterInput;
}

export type ListStorefrontQueryData = Array<{
  id: string;
  name: string;
  salesChannelId: string;
}>

export interface ListStorefrontQuery {
  listStorefront: ListStorefrontQueryData;
}

export type CreateStorefrontJSScriptMutationVariables = {
  input: CreateStorefrontJSScriptInput;
}

export type CreateStorefrontJSScriptMutationData = {
  id: string;
  name: string;
  contentType?: StorefrontJSScriptContentTypeEnum;
  scriptContent: string;
  isActive: boolean;
  isHighPriority?: boolean;
  storefrontId: string;
}

export interface CreateStorefrontJSScriptMutation {
  createStorefrontJSScript: CreateStorefrontJSScriptMutationData;
}

export type UpdateStorefrontJSScriptMutationVariables = {
  input: UpdateStorefrontJSScriptInput;
}

export type UpdateStorefrontJSScriptMutationData = {
  id: string;
  name: string;
  contentType?: StorefrontJSScriptContentTypeEnum;
  scriptContent: string;
  isActive: boolean;
  isHighPriority?: boolean;
  storefrontId: string;
}

export interface UpdateStorefrontJSScriptMutation {
  updateStorefrontJSScript: UpdateStorefrontJSScriptMutationData;
}

export type SaveWebhooksMutationVariables = {
  input: WebhookInput;
}

export type SaveWebhooksMutationData = Array<{
  id: string;
  scope: string;
  endpoint: string;
}>

export interface SaveWebhooksMutation {
  saveWebhooks: SaveWebhooksMutationData;
}

export type ListOrderForAnalyticsQueryVariables = {
  orderedAt?: DateFilterInput;
  pagination?: PaginationInput;
}

export type ListOrderForAnalyticsQueryData = {
  count: number;
  hasNext: boolean;
  page: number;
  limit: number;
  data: Array<{
  id: string;
  orderedAt?: number;
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

  async getSalesChannel(): Promise<APIResult<Partial<GetSalesChannelQuery>>> {
    const query = `
  query getSalesChannel {
    getSalesChannel {
      id
      name
      type
    }
  }
`;
    return this.client.query<Partial<GetSalesChannelQuery>>({ query });
  }

  async listProduct(variables: ListProductQueryVariables): Promise<APIResult<Partial<ListProductQuery>>> {
    const query = `
  query listProduct($pagination: PaginationInput, $id: StringFilterInput) {
    listProduct(pagination: $pagination, id: $id) {
      count
      hasNext
      page
      limit
      data {
        id
        name
        categories {
          id
          name
        }
        vendor {
          id
          name
        }
        brand {
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
            buyPrice
            currencyCode
          }
        }
      }
    }
  }
`;
    return this.client.query<Partial<ListProductQuery>>({ query, variables });
  }

  async listStorefront(variables: ListStorefrontQueryVariables): Promise<APIResult<Partial<ListStorefrontQuery>>> {
    const query = `
  query listStorefront($salesChannelId: StringFilterInput) {
    listStorefront(salesChannelId: $salesChannelId) {
      id
      name
      salesChannelId
    }
  }
`;
    return this.client.query<Partial<ListStorefrontQuery>>({ query, variables });
  }

  async listOrderForAnalytics(variables: ListOrderForAnalyticsQueryVariables): Promise<APIResult<Partial<ListOrderForAnalyticsQuery>>> {
    const query = `
  query listOrderForAnalytics($orderedAt: DateFilterInput, $pagination: PaginationInput) {
    listOrder(orderedAt: $orderedAt, pagination: $pagination) {
      count
      hasNext
      page
      limit
      data {
        id
        orderedAt
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

  async updateProduct(variables: UpdateProductMutationVariables): Promise<APIResult<Partial<UpdateProductMutation>>> {
    const mutation = `
  mutation updateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      id
      vendor {
        id
        name
      }
    }
  }
`;
    return this.client.mutate<Partial<UpdateProductMutation>>({ mutation, variables });
  }

  async createStorefrontJSScript(variables: CreateStorefrontJSScriptMutationVariables): Promise<APIResult<Partial<CreateStorefrontJSScriptMutation>>> {
    const mutation = `
  mutation createStorefrontJSScript($input: CreateStorefrontJSScriptInput!) {
    createStorefrontJSScript(input: $input) {
      id
      name
      contentType
      scriptContent
      isActive
      isHighPriority
      storefrontId
    }
  }
`;
    return this.client.mutate<Partial<CreateStorefrontJSScriptMutation>>({ mutation, variables });
  }

  async updateStorefrontJSScript(variables: UpdateStorefrontJSScriptMutationVariables): Promise<APIResult<Partial<UpdateStorefrontJSScriptMutation>>> {
    const mutation = `
  mutation updateStorefrontJSScript($input: UpdateStorefrontJSScriptInput!) {
    updateStorefrontJSScript(input: $input) {
      id
      name
      contentType
      scriptContent
      isActive
      isHighPriority
      storefrontId
    }
  }
`;
    return this.client.mutate<Partial<UpdateStorefrontJSScriptMutation>>({ mutation, variables });
  }

  async saveWebhooks(variables: SaveWebhooksMutationVariables): Promise<APIResult<Partial<SaveWebhooksMutation>>> {
    const mutation = `
  mutation saveWebhooks($input: WebhookInput!) {
    saveWebhooks(input: $input) {
      id
      scope
      endpoint
    }
  }
`;
    return this.client.mutate<Partial<SaveWebhooksMutation>>({ mutation, variables });
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
