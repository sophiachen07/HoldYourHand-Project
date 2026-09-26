require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const {
  WebSocket,
  WebSocketServer,
} = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;
const HF_API_KEY = process.env.HF_API_KEY;

// 啟用中介軟體
app.use(cors());
app.use(express.json());

// 預設安撫回覆字串
const DEFAULT_FALLBACK_REPLY = '我現在有點累在休息，但我會一直陪著你，我們一起深呼吸好嗎？';

// ==========================================
// 心理陪伴聊天小助手 API 路由
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userData = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '請提供有效的 message 內容' });
    }

    // 解析 userData 欄位
    const age = userData.age || '未知';
    const gender = userData.gender || '未知';

    // 容錯處理：支援字串或陣列
    const rawBfrbType = userData.bfrbType || userData.bfrbTypes;
    const bfrbType = Array.isArray(rawBfrbType)
      ? rawBfrbType.join('、')
      : (rawBfrbType || '未指定');

    const rawDriver = userData.innerDriver || userData.bfrbDriver || userData.bfrbDrivers;
    const innerDriver = Array.isArray(rawDriver)
      ? rawDriver.join('、')
      : (rawDriver || '未指定');

    const statusAndCount = userData.statusAndCount ||
      userData.status ||
      (userData.todayCount !== undefined ? `今日發生 ${userData.todayCount} 次` : '未提供');

    // 組裝 System Prompt
    const systemPrompt = `你是一個溫柔的心理陪伴助手。這位使用者的背景為（年齡：${age}、性別：${gender}），其身體集中重複行為(BFRB)類型為${bfrbType}，內在驅動篩查結果為${innerDriver}，目前狀態與次數：${statusAndCount}。請根據上述心理與行為背景，用簡短、口語且溫暖的一句話安撫對方的焦慮，不要說教，且絕對不能提供醫療診斷或處方。`;

    if (!HF_API_KEY) {
      throw new Error('未設定 HF_API_KEY 環境變數');
    }

    // 指定模型為 Qwen/Qwen2.5-7B-Instruct
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
            { role: 'user', content: message.trim() },
          ],
          max_tokens: 200,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15 秒超時
        }
      );
    } catch (primaryErr) {
      // 若指定 7B 模型在當前 provider 不可用時，自動 fallback 到 Qwen2.5 相容模型
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
              { role: 'user', content: message.trim() },
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

    const reply =
      hfResponse.data?.choices?.[0]?.message?.content?.trim() ||
      DEFAULT_FALLBACK_REPLY;

    return res.json({ reply });
  } catch (error) {
    // 實作 try-catch 錯誤處理：請求超時、額度用盡或發生錯誤時回傳 HTTP 500
    console.error('[Chat API Error]', error.response?.data || error.message);
    return res.status(500).json({
      reply: DEFAULT_FALLBACK_REPLY,
      error: error.response?.data || error.message,
    });
  }
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('----------------------------------------');
  console.log('Aura 伺服器 (HTTP & WebSocket) 已啟動');
  console.log(`HTTP API 端點：http://localhost:${PORT}`);
  console.log(`電腦端 WebSocket 位址：ws://localhost:${PORT}`);
  console.log(`手機端 WebSocket 位址：ws://你的電腦IP:${PORT}`);
  console.log('按 Ctrl + C 可以停止伺服器');
  console.log('----------------------------------------');
});

httpServer.on('error', (error) => {
  console.error('伺服器啟動失敗：', error.message);
});