const {
  WebSocket,
  WebSocketServer,
} = require('ws');

const PORT = 8080;

const server = new WebSocketServer({
  host: '0.0.0.0',
  port: PORT,
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

server.on('listening', () => {
  console.log('----------------------------------------');
  console.log('Aura WebSocket 伺服器已啟動');
  console.log(`電腦端位址：ws://localhost:${PORT}`);
  console.log(`手機端位址：ws://你的電腦IP:${PORT}`);
  console.log('按 Ctrl + C 可以停止伺服器');
  console.log('----------------------------------------');
});

server.on('error', (error) => {
  console.error('伺服器啟動失敗：', error.message);
});