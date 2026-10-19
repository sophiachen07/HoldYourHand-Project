require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const {
  WebSocket,
  WebSocketServer,
} = require('ws');
const rateLimit = require('express-rate-limit');
const { initDatabase, getPool, DB_NAME } = require('./db');
const { optionalAuthenticate } = require('./auth');
const userRoutes = require('./userRoutes');

const app = express();
const PORT = process.env.PORT || 8080;
const HF_API_KEY = process.env.HF_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 信任反向代理 (解決 Render / Heroku 雲端環境下 X-Forwarded-For 報錯問題)
app.set('trust proxy', 1);

// 啟用中介軟體
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 預設安撫回覆字串
const DEFAULT_FALLBACK_REPLY = '我現在有點累在休息，但我會一直陪著你，我們一起深呼吸好嗎？';

// 未設定 AI Key 時直接告知，不假裝是 AI 回覆
const AI_NOT_CONFIGURED_REPLY = '目前未設定連線，小樹洞暫無法使用。';

// AI 聊天端點頻率限制器：每個 IP 每分鐘最多 60 次請求
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  message: {
    reply: '小樹洞剛剛聽了好多話，我們先放鬆深呼吸休息 20 秒再繼續聊好嗎？🌱',
    error: '請求過於頻繁，請稍候再試',
    code: 'RATE_LIMITED',
  },
});

function parseJsonColumn(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

let cachedGeminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

async function resolveGeminiModel(apiKey) {
  // 若快取中不是已失效的舊版 2.5 或 1.5 模型，直接沿用
  if (
    cachedGeminiModel &&
    !cachedGeminiModel.includes('2.5') &&
    !cachedGeminiModel.includes('1.5') &&
    !cachedGeminiModel.includes('2.0')
  ) {
    return cachedGeminiModel;
  }

  try {
    const listRes = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 8000 }
    );
    const models = listRes.data?.models || [];
    const supported = models.filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        m.name?.includes('gemini')
    );

    // 優先挑選最新 3.8-flash 或 3.5-flash-lite，明確避開已下線的 2.5 / 2.0 / 1.5
    const flashModel =
      supported.find((m) => m.name.includes('3.8-flash')) ||
      supported.find((m) => m.name.includes('3.5-flash-lite')) ||
      supported.find((m) => m.name.includes('3.5-flash')) ||
      supported.find((m) => m.name.includes('3.6-flash')) ||
      supported.find(
        (m) =>
          m.name.includes('flash') &&
          !m.name.includes('2.5') &&
          !m.name.includes('2.0') &&
          !m.name.includes('1.5')
      ) ||
      supported[0];

    if (flashModel) {
      cachedGeminiModel = flashModel.name.replace(/^models\//, '');
      console.log(`[Gemini] 自動匹配到可用模型: ${cachedGeminiModel}`);
      return cachedGeminiModel;
    }
  } catch (err) {
    console.warn('[Gemini] 動態探測可用模型失敗，改用相容候選清單:', err.response?.status, err.message);
  }

  cachedGeminiModel = 'gemini-3.8-flash';
  return cachedGeminiModel;
}

// ==========================================
// 心理陪伴聊天小助手 API 路由
// ==========================================
app.post('/api/chat', chatLimiter, optionalAuthenticate, async (req, res) => {
  try {
    const { message, userData = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '請提供有效的 message 內容' });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({ error: '請提供有效的 message 內容' });
    }

    // 限制輸入訊息長度上限 (500 字元)，防止 Prompt 濫用與過度消耗 Token
    if (trimmedMessage.length > 500) {
      return res.status(400).json({
        reply: '說的內容稍微有點長，可以試著用簡短的一兩句話和我分享心情嗎？',
        error: '訊息內容不可超過 500 個字元',
        code: 'MESSAGE_TOO_LONG',
      });
    }

    if (!GEMINI_API_KEY && !HF_API_KEY) {
      return res.status(503).json({
        code: 'AI_NOT_CONFIGURED',
        reply: AI_NOT_CONFIGURED_REPLY,
      });
    }

    let age = '未知';
    let gender = '未知';
    let bfrbType = '未指定';
    let innerDriver = '未指定';
    let statusAndCount = '未提供';

    // 若使用者為已登入狀態，一律從伺服器端資料庫讀取真實背景，禁止前端任意竄改偽造
    if (req.user && req.user.userId && getPool()) {
      try {
        const [[userRow]] = await getPool().query(
          'SELECT age, gender, bfrb_types, bfrb_drivers FROM users WHERE id = ?',
          [req.user.userId]
        );
        if (userRow) {
          age = userRow.age ? String(userRow.age).slice(0, 10) : '未知';
          gender = userRow.gender ? String(userRow.gender).slice(0, 10) : '未知';
          const types = parseJsonColumn(userRow.bfrb_types, []);
          bfrbType = Array.isArray(types) && types.length > 0 ? types.join('、').slice(0, 30) : '未指定';
          const drivers = parseJsonColumn(userRow.bfrb_drivers, []);
          innerDriver = Array.isArray(drivers) && drivers.length > 0 ? drivers.join('、').slice(0, 50) : '未指定';
        }
      } catch (err) {
        console.warn('[Chat] 讀取使用者背景資料失敗，採用預設值:', err.message);
      }
    } else {
      // 訪客模式：對前端提交的 userData 進行嚴格白名單與防注入過濾
      if (userData && typeof userData === 'object') {
        const rawAge = String(userData.age || '').replace(/[^\d]/g, '');
        const numAge = Number(rawAge);
        if (numAge > 0 && numAge < 120) age = String(numAge);

        const allowedGenders = ['男性', '女性', '其他'];
        if (allowedGenders.includes(String(userData.gender || '').trim())) {
          gender = String(userData.gender).trim();
        }

        const rawType = userData.bfrbType || userData.bfrbTypes;
        if (rawType) {
          const typeStr = Array.isArray(rawType) ? rawType.join('、') : String(rawType);
          bfrbType = typeStr.replace(/[\r\n]/g, '').slice(0, 30);
        }

        const rawDriver = userData.innerDriver || userData.bfrbDriver || userData.bfrbDrivers;
        if (rawDriver) {
          const driverStr = Array.isArray(rawDriver) ? rawDriver.join('、') : String(rawDriver);
          innerDriver = driverStr.replace(/[\r\n]/g, '').slice(0, 50);
        }
      }
    }

    if (userData?.statusAndCount || userData?.status) {
      statusAndCount = String(userData.statusAndCount || userData.status)
        .replace(/[\r\n]/g, '')
        .slice(0, 30);
    } else if (userData?.todayCount !== undefined) {
      const cnt = Math.max(0, Math.min(Number(userData.todayCount) || 0, 999));
      statusAndCount = `今日發生 ${cnt} 次`;
    }

    // 組裝 System Prompt
    const systemPrompt = `你是一個溫柔的心理陪伴助手。這位使用者的背景為（年齡：${age}、性別：${gender}），其身體集中重複行為(BFRB)類型為${bfrbType}，內在驅動篩查結果為${innerDriver}，目前狀態與次數：${statusAndCount}。請根據上述心理與行為背景，用簡短、口語且溫暖的一兩句話安撫對方的焦慮，語氣自然溫柔，句子必須完整說完，不要說教，且絕對不能提供醫療診斷或處方。`;

    let reply = null;

    // 1. 若有設定 Google Gemini API，優先呼叫 Gemini（完全免費、繁體中文自然流暢且回應迅速）
    if (GEMINI_API_KEY) {
      const candidateModels = [];
      if (process.env.GEMINI_MODEL) {
        candidateModels.push(process.env.GEMINI_MODEL);
      }
      const discovered = await resolveGeminiModel(GEMINI_API_KEY);
      if (discovered && !candidateModels.includes(discovered)) {
        candidateModels.push(discovered);
      }
      // 容錯備用候選清單：以 3.8-flash 為主，3.5-flash-lite 為備援
      const fallbackList = [
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
      ];
      for (const m of fallbackList) {
        if (!candidateModels.includes(m)) candidateModels.push(m);
      }

      for (const modelName of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
          
          // 關閉 thinkingBudget (設為 0)，避免模型內部漫長思考延遲與消耗 Token 導致句子斷斷續續
          const payload = {
            system_instruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: trimmedMessage }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          };

          let geminiResponse;
          try {
            geminiResponse = await axios.post(geminiUrl, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000,
            });
          } catch (postErr) {
            // 若該模型不支援 thinkingConfig 報錯 400，降級不帶 thinkingConfig 重試
            if (
              postErr.response?.status === 400 &&
              postErr.response?.data?.error?.message?.includes('thinkingConfig')
            ) {
              delete payload.generationConfig.thinkingConfig;
              geminiResponse = await axios.post(geminiUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000,
              });
            } else {
              throw postErr;
            }
          }

          // 提取所有非思考區塊的完整文字，防止截斷或抓到思考過程
          const parts = geminiResponse.data?.candidates?.[0]?.content?.parts || [];
          const fullText = parts
            .filter((p) => !p.thought && p.text)
            .map((p) => p.text)
            .join('')
            .trim();

          if (fullText) {
            reply = fullText;
            cachedGeminiModel = modelName;
            break;
          }
        } catch (geminiErr) {
          console.warn(
            `[Gemini API Warning] 模型 ${modelName} 呼叫失敗:`,
            geminiErr.response?.status,
            geminiErr.response?.data?.error?.message || geminiErr.message
          );
          // 若為 404 等錯誤，自動嘗試下一個候選模型
          continue;
        }
      }
    }

    // 2. 若未設定 Gemini 或 Gemini 呼叫失敗，嘗試使用 Hugging Face 作為備援
    if (!reply && HF_API_KEY) {
      const primaryModel = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
      const fallbackModel = 'Qwen/Qwen2.5-72B-Instruct';

      let hfResponse;
      try {
        hfResponse = await axios.post(
          'https://router.huggingface.co/v1/chat/completions',
          {
            model: primaryModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: trimmedMessage },
            ],
            max_tokens: 200,
            temperature: 0.7,
          },
          {
            headers: {
              'Authorization': `Bearer ${HF_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );
      } catch (primaryErr) {
        if (
          primaryErr.response?.data?.error?.code === 'model_not_supported' ||
          primaryErr.response?.data?.error?.message?.includes('not supported')
        ) {
          console.warn(`[HF API] ${primaryModel} 在當前 provider 不可用，自動嘗試相容模型 ${fallbackModel}`);
          hfResponse = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
              model: fallbackModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: trimmedMessage },
              ],
              max_tokens: 200,
              temperature: 0.7,
            },
            {
              headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json',
              },
              timeout: 15000,
            }
          );
        } else {
          throw primaryErr;
        }
      }

      reply = hfResponse.data?.choices?.[0]?.message?.content?.trim();
    }

    if (!reply) {
      throw new Error('AI 服務無法產生回覆');
    }

    return res.json({ reply });
  } catch (error) {
    // 安全錯誤處理：日誌記錄內部詳細資訊，但對客戶端僅回傳保底內容，避免洩露 API Key 或伺服器細節
    const isRateLimit =
      error.response?.status === 429 ||
      error.message?.includes('429') ||
      error.message?.includes('ResourceExhausted');
    console.error('[Chat API Error]', error.response?.status || error.name, error.message);
    return res.status(500).json({
      reply: isRateLimit
        ? '小樹洞剛剛聽得太專心有點喘不過氣，我們先深呼吸放鬆 10 秒鐘再繼續聊好嗎？🌱'
        : DEFAULT_FALLBACK_REPLY,
      error: '陪伴助手連線逾時或暫時忙碌中，請稍後再試',
    });
  }
});

// ==========================================
// 使用者資料 API（MySQL）
// ==========================================
app.use('/api/users', userRoutes);

// 前端需要的公開設定（Google 用戶端 ID 不是機密）
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// 健康檢查路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'aura-server', time: new Date().toISOString() });
});

// ==========================================
// 建立 HTTP 伺服器並整合 WebSocket 服務
// ==========================================
const httpServer = http.createServer(app);

const server = new WebSocketServer({
  server: httpServer,
});

let nextClientId = 1;

server.on('connection', (socket, request) => {
  const clientId = nextClientId;
  nextClientId += 1;

  const clientAddress = request.socket.remoteAddress;

  console.log(
    `[連線成功] 用戶端 #${clientId}，來源：${clientAddress}`
  );

  socket.send(
    JSON.stringify({
      type: 'server-status',
      status: 'connected',
      clientId,
      message: '已連接 Aura WebSocket 伺服器',
    })
  );

  socket.on('message', (buffer) => {
    const rawMessage = buffer.toString();

    let receivedData;

    try {
      receivedData = JSON.parse(rawMessage);
    } catch (error) {
      console.error(
        `[格式錯誤] 用戶端 #${clientId} 傳來的資料不是有效 JSON`
      );

      socket.send(
        JSON.stringify({
          type: 'server-error',
          message: '傳送內容必須是有效的 JSON',
        })
      );

      return;
    }

    console.log(
      `[收到資料] 用戶端 #${clientId}`,
      receivedData
    );

    let deliveredCount = 0;

    for (const client of server.clients) {
      if (
        client !== socket &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(JSON.stringify(receivedData));
        deliveredCount += 1;
      }
    }

    socket.send(
      JSON.stringify({
        type: 'server-ack',
        receivedAt: new Date().toISOString(),
        deliveredCount,
        message: '伺服器已收到感測資料',
      })
    );
  });

  socket.on('close', () => {
    console.log(`[連線中斷] 用戶端 #${clientId}`);
  });

  socket.on('error', (error) => {
    console.error(
      `[連線錯誤] 用戶端 #${clientId}`,
      error.message
    );
  });
});

if (require.main === module) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('----------------------------------------');
    console.log('Aura 伺服器 (HTTP & WebSocket) 已啟動');
    console.log(`HTTP API 端點：http://localhost:${PORT}`);
    console.log(`電腦端 WebSocket 位址：ws://localhost:${PORT}`);
    console.log(`手機端 WebSocket 位址：ws://你的電腦IP:${PORT}`);
    console.log('按 Ctrl + C 可以停止伺服器');
    console.log('----------------------------------------');

    if (!GEMINI_API_KEY && !HF_API_KEY) {
      console.warn('⚠️  未設定 GEMINI_API_KEY 或 HF_API_KEY：小樹洞 AI 無法使用（請在 .env 或 Render 設定 GEMINI_API_KEY）');
    } else if (GEMINI_API_KEY) {
      console.log('🤖 小樹洞 AI：已啟用 Google Gemini API (自動適配最佳 Flash 模型)');
    } else {
      console.log('🤖 小樹洞 AI：已啟用 Hugging Face API');
    }

    // 連線 MySQL（失敗時伺服器照常運作，只有 /api/users 會回 503）
    initDatabase()
      .then(() => console.log(`[DB] MySQL 已連線，資料庫：${DB_NAME}`))
      .catch((err) => {
        console.error(`[DB] MySQL 連線失敗：${err.message}`);
        console.error('[DB] 請確認 MySQL 已啟動，並檢查 .env 的 DB_HOST / DB_USER / DB_PASSWORD');
      });
  });

  httpServer.on('error', (error) => {
    console.error('伺服器啟動失敗：', error.message);
  });
}

module.exports = { app, httpServer };