// this file is a wrapper with defaults to be used in both API routes and `getServerSideProps` functions
import { config } from '@/globals/config';
import { TOKEN_COOKIE } from '@/globals/constants';
import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  merchantId?: string;
  authorizedAppId?: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  [key: string]: unknown;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // iron-session requires 32+ chars; fail with a clear message instead of an empty password.
  if (!config.cookiePassword || config.cookiePassword.length < 32) {
    throw new Error('SECRET_COOKIE_PASSWORD must be set and at least 32 characters');
  }
  const session = await getIronSession(await cookies(), { password: config.cookiePassword, cookieName: TOKEN_COOKIE || '' });
  return session;
}

export async function setSession(data: SessionData) {
  const session = await getSession();
  Object.assign(session, data);
  await session.save();
}
