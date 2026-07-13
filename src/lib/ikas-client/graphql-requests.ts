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

export const LIST_ORDER = gql`
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

export const LIST_PRODUCT = gql`
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

export const LIST_STOREFRONT = gql`
  query listStorefront($salesChannelId: StringFilterInput) {
    listStorefront(salesChannelId: $salesChannelId) {
      id
      name
      type
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

export const LIST_ORDER_FOR_ANALYTICS = gql`
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