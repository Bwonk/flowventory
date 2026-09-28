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

// Sipariş belgeleri (PDF / e-posta) için "sipariş veren" kutusu: unvan, vergi
// bilgisi, adres. Ayrı işlem — getMerchant'ı kullanan akışlar bu alanları taşımasın.
export const GET_MERCHANT_PROFILE = gql`
  query getMerchantProfile {
    getMerchant {
      id
      email
      storeName
      phoneNumber
      address {
        company
        title
        taxOffice
        taxNumber
        vkn
        addressLine1
        addressLine2
        postalCode
        city {
          name
        }
        district {
          name
        }
      }
    }
  }
`;

export const GET_AUTHORIZED_APP = gql`
  query getAuthorizedApp {
    getAuthorizedApp {
      id
      salesChannelId
      storeAppId
      deleted
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

export const DELETE_STOREFRONT_JS_SCRIPT = gql`
  mutation deleteStorefrontJSScript {
    deleteStorefrontJSScript
  }
`;

export const CREATE_ORDER_WITH_TRANSACTIONS = gql`
  mutation createOrderWithTransactions($input: PublicCreateOrderWithTransactionsInput!) {
    createOrderWithTransactions(input: $input) {
      id
      orderNumber
      orderedAt
      totalFinalPrice
      currencyCode
      status
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
// Uygulama aboneliği — mağazanın ikas lisansı ve bu uygulama için alınmış
// abonelikler. Hak kontrolü `appSubscriptions` üzerinden (status ACTIVE && !deleted).
export const GET_MERCHANT_LICENCE = gql`
  query getMerchantLicence {
    getMerchantLicence {
      region
      appSubscriptions {
        id
        storeAppId
        storeAppListingSubscriptionKey
        status
        deleted
        lastPaymentDate
        lastPaymentPeriod
        lastPaymentPeriodInDays
      }
    }
  }
`;

// Mağazanın satın alabileceği planlar (Partner panel › Planlar, bölgeye göre).
// Birden fazla bölge planı varsa ödeme bu listeden mağazaya uyan anahtarla açılır.
export const GET_AVAILABLE_SUBSCRIPTIONS = gql`
  query getAvailableSubscriptions {
    getAvailableSubscriptions {
      key
      currencyCode
      prices {
        period
        price
      }
    }
  }
`;

// Abonelik ödemesi oluşturur; dönen id `AppBridgeHelper.startMerchantPayment`e verilir.
export const CREATE_MERCHANT_APP_PAYMENT = gql`
  mutation createMerchantAppPayment($input: CreateMerchantAppPaymentWithSubscriptionInput!) {
    createMerchantAppPayment(input: $input) {
      id
      status
    }
  }
`;
