/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { PlayRecord } from '@/lib/types';

export const runtime = 'edge';

// 用户播放统计接口
export interface UserPlayStat {
  username: string;
  totalWatchTime: number; // 总观看时间（秒）
  totalPlays: number; // 总播放次数
  lastPlayTime: number; // 最后播放时间
  recentRecords: PlayRecord[]; // 最近播放记录（最多10条）
  avgWatchTime: number; // 平均每次观看时长
  mostWatchedSource: string; // 最常观看的来源
}

// 播放统计汇总数据
export interface PlayStatsResult {
  totalUsers: number; // 总用户数
  totalWatchTime: number; // 全站总观看时间
  totalPlays: number; // 全站总播放次数
  avgWatchTimePerUser: number; // 用户平均观看时长
  avgPlaysPerUser: number; // 用户平均播放次数
  userStats: UserPlayStat[]; // 每个用户的统计
  topSources: Array<{ source: string; count: number }>; // 热门来源统计
  dailyStats: Array<{ date: string; watchTime: number; plays: number }>; // 近7天每日统计
}

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行播放统计查看',
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
    const storage = db;
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
    const userStats: UserPlayStat[] = [];
    let totalWatchTime = 0;
    let totalPlays = 0;
    const sourceCount: Record<string, number> = {};
    const dailyData: Record<string, { watchTime: number; plays: number }> = {};

    // 计算近7天的日期范围
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
            avgWatchTime: 0,
            mostWatchedSource: '',
          });
          continue;
        }

        // 计算用户统计
        let userWatchTime = 0;
        let userLastPlayTime = 0;
        const userSourceCount: Record<string, number> = {};

        records.forEach((record) => {
          // 累计观看时间（使用播放进度）
          userWatchTime += record.play_time || 0;

          // 更新最后播放时间
          if (record.save_time > userLastPlayTime) {
            userLastPlayTime = record.save_time;
          }

          // 统计来源
          const sourceName = record.source_name || '未知来源';
          userSourceCount[sourceName] = (userSourceCount[sourceName] || 0) + 1;
          sourceCount[sourceName] = (sourceCount[sourceName] || 0) + 1;

          // 统计近7天数据
          const recordDate = new Date(record.save_time);
          if (recordDate >= sevenDaysAgo) {
            const dateKey = recordDate.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { watchTime: 0, plays: 0 };
            }
            dailyData[dateKey].watchTime += record.play_time || 0;
            dailyData[dateKey].plays += 1;
          }
        });

        // 获取最近播放记录（按时间倒序，最多10条）
        const recentRecords = records
          .sort((a, b) => (b.save_time || 0) - (a.save_time || 0))
          .slice(0, 10);

        // 找出最常观看的来源
        let mostWatchedSource = '';
        let maxCount = 0;
        for (const [source, count] of Object.entries(userSourceCount)) {
          if (count > maxCount) {
            maxCount = count;
            mostWatchedSource = source;
          }
        }

        const userStat: UserPlayStat = {
          username: user.username,
          totalWatchTime: userWatchTime,
          totalPlays: records.length,
          lastPlayTime: userLastPlayTime,
          recentRecords,
          avgWatchTime: records.length > 0 ? userWatchTime / records.length : 0,
          mostWatchedSource,
        };

        userStats.push(userStat);

        // 累计全站统计
        totalWatchTime += userWatchTime;
        totalPlays += records.length;
      } catch (error) {
        // console.error(`获取用户 ${user.username} 播放记录失败:`, error);
        // 出错的用户显示为空统计
        userStats.push({
          username: user.username,
          totalWatchTime: 0,
          totalPlays: 0,
          lastPlayTime: 0,
          recentRecords: [],
          avgWatchTime: 0,
          mostWatchedSource: '',
        });
      }
    }

    // 按观看时间降序排序
    userStats.sort((a, b) => b.totalWatchTime - a.totalWatchTime);

    // 整理热门来源数据（取前5个）
    const topSources = Object.entries(sourceCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));

    // 整理近7天数据
    const dailyStats: Array<{ date: string; watchTime: number; plays: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const data = dailyData[dateKey] || { watchTime: 0, plays: 0 };
      dailyStats.push({
        date: dateKey,
        watchTime: data.watchTime,
        plays: data.plays,
      });
    }

    const result: PlayStatsResult = {
      totalUsers: allUsers.length,
      totalWatchTime,
      totalPlays,
      avgWatchTimePerUser: allUsers.length > 0 ? totalWatchTime / allUsers.length : 0,
      avgPlaysPerUser: allUsers.length > 0 ? totalPlays / allUsers.length : 0,
      userStats,
      topSources,
      dailyStats,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 不缓存，确保数据实时性
      },
    });
  } catch (error) {
    // console.error('获取播放统计失败:', error);
    return NextResponse.json(
      {
        error: '获取播放统计失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}