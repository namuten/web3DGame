/**
 * MongoDB → MySQL 데이터 이전 스크립트
 *
 * 사용법:
 *   cd server
 *   MONGO_URL=mongodb://localhost:25321/web3dgame tsx --env-file=.env scripts/migrate-mongo-to-mysql.ts
 */

import { MongoClient } from 'mongodb';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:25321/web3dgame';

const mysqlPool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME     ?? 'twdb',
  user:     process.env.DB_USER     ?? 'twuser',
  password: process.env.DB_PASSWORD ?? '',
});

async function migrate() {
  // ── MongoDB 연결 ──────────────────────────────────────────────
  console.log('MongoDB 연결 중...', MONGO_URL);
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const db = mongo.db();
  const docs = await db.collection('characters').find({}).toArray();
  console.log(`MongoDB에서 ${docs.length}개 캐릭터 조회 완료`);

  if (docs.length === 0) {
    console.log('이전할 데이터가 없습니다.');
    await mongo.close();
    await mysqlPool.end();
    return;
  }

  // ── MySQL 테이블 생성 ─────────────────────────────────────────
  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id          VARCHAR(36)   NOT NULL PRIMARY KEY,
      name        VARCHAR(20)   NOT NULL,
      description VARCHAR(100),
      bodyColor   VARCHAR(7)    NOT NULL,
      flowerColor VARCHAR(7)    NOT NULL,
      visorColor  VARCHAR(7)    NOT NULL,
      flowerType  VARCHAR(20)   NOT NULL DEFAULT 'daisy',
      createdAt   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('MySQL characters 테이블 준비 완료');

  // ── 데이터 이전 ───────────────────────────────────────────────
  let inserted = 0;
  let skipped  = 0;

  for (const doc of docs) {
    const id = uuidv4();
    try {
      await mysqlPool.execute(
        `INSERT IGNORE INTO characters
           (id, name, description, bodyColor, flowerColor, visorColor, flowerType, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          doc['name']        ?? '이름없음',
          doc['description'] ?? null,
          doc['bodyColor']   ?? '#FFB7B2',
          doc['flowerColor'] ?? '#FFB7B2',
          doc['visorColor']  ?? '#333333',
          doc['flowerType']  ?? 'daisy',
          doc['createdAt']   ?? new Date(),
        ]
      );
      console.log(`  ✅ ${doc['name']} → ${id}`);
      inserted++;
    } catch (err: any) {
      console.warn(`  ⚠️  ${doc['name']} 스킵 (${err.message})`);
      skipped++;
    }
  }

  console.log(`\n완료: ${inserted}개 이전, ${skipped}개 스킵`);

  await mongo.close();
  await mysqlPool.end();
}

migrate().catch((err) => {
  console.error('이전 실패:', err);
  process.exit(1);
});
