const deployUrl = process.env.NEXT_PUBLIC_DEPLOY_URL?.replace(/\/+$/, '');

export const config = {
  // Graph API and Store config
  graphApiUrl: process.env.NEXT_PUBLIC_GRAPH_API_URL,
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL,
  cookiePassword: process.env.SECRET_COOKIE_PASSWORD,

  // OAuth configuration
  oauth: {
    scope: 'read_orders,write_orders,read_products,write_products,read_inventories,write_inventories,write_storefronts',
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `${deployUrl}/api/oauth/callback/ikas`,
  }
};

export type Config = typeof config;
