// ==========================================
// HoldYourHand 第一階段資安防禦自動化測試套件
// 測試框架：Node.js 原生 test runner + Supertest
// 測試涵蓋：BOLA/IDOR 防護、Token 驗證、Email OTP、AI API 濫用防護
// ==========================================
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../server');
const {
  signToken,
  verifyToken,
  hashVerificationCode,
  verifyCodeHash,
  hashPassword,
  verifyPassword,
} = require('../auth');

// 測試用虛構帳號 (絕無真實使用者資料)
const MOCK_USER_A = { userId: 101, email: 'test.user.a@holdyourhand.test' };
const MOCK_USER_B = { userId: 202, email: 'test.user.b@holdyourhand.test' };

const tokenA = signToken(MOCK_USER_A);
const tokenB = signToken(MOCK_USER_B);

test('資安驗證 1：未登入者無法讀取私人使用者資料 (HTTP 401)', async () => {
  const res = await request(app)
    .get('/api/users/101')
    .expect(401);

  assert.equal(res.body.code, 'UNAUTHORIZED');
  assert.match(res.body.error, /請先登入/);
});

test('資安驗證 2：使用者 A 無法讀取使用者 B 的資料 - 防 BOLA/IDOR (HTTP 403)', async () => {
  const res = await request(app)
    .get('/api/users/202')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(403);

  assert.equal(res.body.code, 'FORBIDDEN_USER_ACCESS');
  assert.match(res.body.error, /無權檢視或修改其他使用者/);
});

test('資安驗證 3：使用者 A 無法修改或覆蓋使用者 B 的紀錄 - 防 BOLA/IDOR (HTTP 403)', async () => {
  const res = await request(app)
    .put('/api/users/202/sync')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      profile: { name: '惡意竄改名稱' },
      behaviorStats: {},
      dailyHistory: {},
    })
    .expect(403);

  assert.equal(res.body.code, 'FORBIDDEN_USER_ACCESS');
});

test('資安驗證 4：只修改 URL 中的 userId 無法越權操作他人事件 (HTTP 403)', async () => {
  const res = await request(app)
    .post('/api/users/202/events')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ type: '摳皮膚', occurredAt: Date.now() })
    .expect(403);

  assert.equal(res.body.code, 'FORBIDDEN_USER_ACCESS');
});

test('資安驗證 5：無效、過期或遭竄改的 Token 會被拒絕 (HTTP 401)', async () => {
  // 偽造隨機字串 Token
  const tamperedToken = tokenA.slice(0, -6) + 'xxxxxx';
  const res = await request(app)
    .get('/api/users/101')
    .set('Authorization', `Bearer ${tamperedToken}`)
    .expect(401);

  assert.equal(res.body.code, 'INVALID_TOKEN');
});

test('資安驗證 6：舊版未經 Email 驗證之直接登入端點已被安全停用 (HTTP 400)', async () => {
  const res = await request(app)
    .post('/api/users/login')
    .send({ email: 'victim@holdyourhand.test' })
    .expect(400);

  assert.equal(res.body.code, 'VERIFICATION_REQUIRED');
  assert.match(res.body.error, /請使用驗證碼或 Google 登入/);
});

test('資安驗證 7：Email 驗證碼常數時間雜湊與比對安全機制', () => {
  const email = 'tester@holdyourhand.test';
  const realCode = '654321';
  const wrongCode = '123456';

  const hash = hashVerificationCode(email, realCode);

  // 正確驗證碼比對成功
  assert.equal(verifyCodeHash(email, realCode, hash), true);

  // 錯誤驗證碼比對失敗
  assert.equal(verifyCodeHash(email, wrongCode, hash), false);

  // 不同信箱使用相同驗證碼比對失敗 (信箱綁定)
  assert.equal(verifyCodeHash('other@holdyourhand.test', realCode, hash), false);
});

test('資安驗證 8：Google 登入傳入無效 Token 會被拒絕 (HTTP 401 或 400)', async () => {
  const res = await request(app)
    .post('/api/users/google-login')
    .send({ idToken: 'fake.google.id.token.for.testing' });

  // 伺服器若無 GOOGLE_CLIENT_ID 則回 503，若有則應回 401 拒絕無效憑證
  assert.ok(res.status === 401 || res.status === 503);
});

test('資安驗證 9：AI API 輸入訊息超過 500 字元長度限制會被拒絕 (HTTP 400)', async () => {
  const excessivelyLongMessage = 'A'.repeat(501);

  const res = await request(app)
    .post('/api/chat')
    .send({ message: excessivelyLongMessage })
    .expect(400);

  assert.equal(res.body.code, 'MESSAGE_TOO_LONG');
  assert.match(res.body.error, /不可超過 500 個字元/);
});

test('資安驗證 10：AI API 空白訊息會被拒絕 (HTTP 400)', async () => {
  const res = await request(app)
    .post('/api/chat')
    .send({ message: '   ' })
    .expect(400);

  assert.match(res.body.error, /請提供有效的 message 內容/);
});

test('資安驗證 11：使用者 A 操作本人端點通過身分授權 (非 401 / 非 403)', async () => {
  const res = await request(app)
    .get('/api/users/101')
    .set('Authorization', `Bearer ${tokenA}`);

  // 通過身分授權中介軟體 (不會被 401 或 403 擋下)
  assert.notEqual(res.status, 401);
  assert.notEqual(res.status, 403);
});

test('資安驗證 12：密碼安全加鹽雜湊與比對機制 (scrypt + 常數時間比對)', () => {
  const password = 'SecretPassword123!';
  const wrongPassword = 'WrongPassword456!';

  const hash = hashPassword(password);
  assert.ok(hash.includes(':'), '密碼雜湊必須包含 salt:key 格式');

  // 正確密碼比對成功
  assert.equal(verifyPassword(password, hash), true);
  // 錯誤密碼比對失敗
  assert.equal(verifyPassword(wrongPassword, hash), false);
  // 空白或無效雜湊防禦
  assert.equal(verifyPassword('', hash), false);
  assert.equal(verifyPassword(password, 'invalid_hash_without_salt'), false);
});
