import { gql } from 'graphql-request';

export const GET_MERCHANT = gql`
  query getMerchant {
    getMerchant {
      id
      email
      storeName
    }
  }
`;

export const GET_AUTHORIZED_APP = gql`
  query getAuthorizedApp {
    getAuthorizedApp {
      id
      salesChannelId
    }
  }
`;

export const GET_SALES_CHANNEL = gql`
  query getSalesChannel {
    getSalesChannel {
      id
      name
      type
    }
  }
`;

export const LIST_PRODUCT = gql`
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

export const SAVE_VARIANT_STOCKS = gql`
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

export const UPDATE_PRODUCT = gql`
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

export const LIST_STOREFRONT = gql`
  query listStorefront($salesChannelId: StringFilterInput) {
    listStorefront(salesChannelId: $salesChannelId) {
      id
      name
      salesChannelId
    }
  }
`;

export const CREATE_STOREFRONT_JS_SCRIPT = gql`
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

export const UPDATE_STOREFRONT_JS_SCRIPT = gql`
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

export const SAVE_WEBHOOKS = gql`
  mutation saveWebhooks($input: WebhookInput!) {
    saveWebhooks(input: $input) {
      id
      scope
      endpoint
    }
  }
`;

export const LIST_ORDER_FOR_ANALYTICS = gql`
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