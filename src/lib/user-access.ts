import { NextResponse } from 'next/server';

import type { AdminConfig } from '@/lib/admin.types';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export type UserRole = 'owner' | 'admin' | 'user';

export class UserNotFoundError extends Error {
  constructor(message = '用户不存在') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class UserBannedError extends Error {
  constructor(message = '用户已被封禁') {
    super(message);
    this.name = 'UserBannedError';
  }
}

export interface ResolvedUser {
  role: UserRole;
  config: AdminConfig;
  user?: AdminConfig['UserConfig']['Users'][number];
}

export async function resolveUserAccess(username: string): Promise<ResolvedUser> {
  let config = await getConfig();

  if (username === process.env.USERNAME) {
    return { role: 'owner', config };
  }

  let user = config.UserConfig.Users.find((u) => u.username === username);

  if (!user) {
    try {
      const exists = await db.checkUserExist(username);
      if (!exists) {
        throw new UserNotFoundError();
      }

      clearConfigCache();
      config = await getConfig();
      user = config.UserConfig.Users.find((u) => u.username === username);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      console.warn('resolveUserAccess: 检查用户存在失败', error);
    }
  }

  if (!user) {
    return { role: 'user', config };
  }

  if (user.banned) {
    throw new UserBannedError();
  }

  return { role: (user.role as UserRole) || 'user', config, user };
}

type GuardResult =
  | { response: NextResponse }
  | { resolved: ResolvedUser };

export async function ensureUserAccessOrResponse(username: string): Promise<GuardResult> {
  try {
    const resolved = await resolveUserAccess(username);
    return { resolved };
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return {
        response: NextResponse.json({ error: '用户不存在' }, { status: 401 }),
      };
    }
    if (error instanceof UserBannedError) {
      return {
        response: NextResponse.json({ error: '用户已被封禁' }, { status: 401 }),
      };
    }
    console.error('ensureUserAccessOrResponse: 未预期错误', error);
    return {
      response: NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
    };
  }
}
