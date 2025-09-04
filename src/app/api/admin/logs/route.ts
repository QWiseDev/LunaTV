/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getStorage } from '@/lib/db';
import { PlayRecord } from '@/lib/types';

export const runtime = 'nodejs';

// 用户播放日志统计接口
export interface UserPlayLogStat {
  username: string;
  totalWatchTime: number; // 总观看时间（秒）
  totalPlays: number; // 总播放次数
  lastPlayTime: number; // 最后播放时间
  recentRecords: PlayRecord[]; // 最近播放记录（最多10条）
}

// 播放日志汇总数据
export interface PlayLogsResult {
  totalUsers: number; // 总用户数
  totalWatchTime: number; // 全站总观看时间
  totalPlays: number; // 全站总播放次数
  userStats: UserPlayLogStat[]; // 每个用户的统计
}

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员日志查看',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getConfig();
    const storage = getStorage();
    const username = authInfo.username;

    // 判定操作者角色
    let _operatorRole: 'owner' | 'admin';
    if (username === process.env.USERNAME) {
      _operatorRole = 'owner';
    } else {
      const userEntry = config.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (!userEntry || userEntry.role !== 'admin' || userEntry.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
      _operatorRole = 'admin';
    }

    // 获取所有用户列表
    const allUsers = config.UserConfig.Users;
    const userStats: UserPlayLogStat[] = [];
    let totalWatchTime = 0;
    let totalPlays = 0;

    // 为每个用户获取播放记录统计
    for (const user of allUsers) {
      try {
        // 获取用户的所有播放记录
        const userPlayRecords = await storage.getAllPlayRecords(user.username);
        const records = Object.values(userPlayRecords);

        if (records.length === 0) {
          // 没有播放记录的用户也要显示
          userStats.push({
            username: user.username,
            totalWatchTime: 0,
            totalPlays: 0,
            lastPlayTime: 0,
            recentRecords: [],
          });
          continue;
        }

        // 计算用户统计
        let userWatchTime = 0;
        let userLastPlayTime = 0;

        records.forEach((record) => {
          // 累计观看时间（使用播放进度）
          userWatchTime += record.play_time || 0;

          // 更新最后播放时间
          if (record.save_time > userLastPlayTime) {
            userLastPlayTime = record.save_time;
          }
        });

        // 获取最近播放记录（按时间倒序，最多10条）
        const recentRecords = records
          .sort((a, b) => (b.save_time || 0) - (a.save_time || 0))
          .slice(0, 10);

        const userStat: UserPlayLogStat = {
          username: user.username,
          totalWatchTime: userWatchTime,
          totalPlays: records.length,
          lastPlayTime: userLastPlayTime,
          recentRecords,
        };

        userStats.push(userStat);

        // 累计全站统计
        totalWatchTime += userWatchTime;
        totalPlays += records.length;
      } catch (error) {
        console.error(`获取用户 ${user.username} 播放记录失败:`, error);
        // 出错的用户显示为空统计
        userStats.push({
          username: user.username,
          totalWatchTime: 0,
          totalPlays: 0,
          lastPlayTime: 0,
          recentRecords: [],
        });
      }
    }

    // 按观看时间降序排序
    userStats.sort((a, b) => b.totalWatchTime - a.totalWatchTime);

    const result: PlayLogsResult = {
      totalUsers: allUsers.length,
      totalWatchTime,
      totalPlays,
      userStats,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 不缓存，确保数据实时性
      },
    });
  } catch (error) {
    console.error('获取播放日志失败:', error);
    return NextResponse.json(
      {
        error: '获取播放日志失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}