/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { PlayRecord } from '@/lib/types';
import { ensureUserAccessOrResponse } from '@/lib/user-access';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guardResult = await ensureUserAccessOrResponse(authInfo.username);
    if ('response' in guardResult) {
      return guardResult.response;
    }

    const records = await db.getAllPlayRecords(authInfo.username);
    return NextResponse.json(records, { status: 200 });
  } catch (err) {
    console.error('获取播放记录失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guardResult = await ensureUserAccessOrResponse(authInfo.username);
    if ('response' in guardResult) {
      return guardResult.response;
    }

    const body = await request.json();
    const { key, record }: { key: string; record: PlayRecord } = body;

    if (!key || !record) {
      return NextResponse.json(
        { error: 'Missing key or record' },
        { status: 400 }
      );
    }

    // 验证播放记录数据
    if (!record.title || !record.source_name || record.index < 1) {
      return NextResponse.json(
        { error: 'Invalid record data' },
        { status: 400 }
      );
    }

    // 从key中解析source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json(
        { error: 'Invalid key format' },
        { status: 400 }
      );
    }

    // 获取现有播放记录以保持原始集数
    const existingRecord = await db.getPlayRecord(authInfo.username, source, id);

    const finalRecord = {
      ...record,
      save_time: record.save_time ?? Date.now(),
      // 关键修复：设置原始集数，首次观看时使用当前集数，后续保持不变
      original_episodes: existingRecord?.original_episodes || record.total_episodes,
    } as PlayRecord;

    await db.savePlayRecord(authInfo.username, source, id, finalRecord);

    // 更新播放统计（如果存储类型支持）
    if (db.isStatsSupported()) {
      await db.updatePlayStatistics(
        authInfo.username,
        source,
        id,
        finalRecord.play_time
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('保存播放记录失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 从 cookie 获取用户信息
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guardResult = await ensureUserAccessOrResponse(authInfo.username);
    if ('response' in guardResult) {
      return guardResult.response;
    }

    const username = authInfo.username;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      // 如果提供了 key，删除单条播放记录
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json(
          { error: 'Invalid key format' },
          { status: 400 }
        );
      }

      await db.deletePlayRecord(username, source, id);
    } else {
      // 未提供 key，则清空全部播放记录
      await db.clearAllPlayRecords(username);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('删除播放记录失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
