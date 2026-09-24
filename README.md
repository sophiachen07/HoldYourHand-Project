# 🖐️ Hold Your Hand (Aura) - 智慧穿戴與 BFRB 習慣逆轉系統

<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?style=for-the-badge&logo=expo&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![BLE](https://img.shields.io/badge/Bluetooth-BLE_4.0+-0082FC?style=for-the-badge&logo=bluetooth&logoColor=white)

<br />

**專為「身體專注重複行為 (BFRB)」打造的智慧穿戴即時監控、觸覺中斷介入與習慣逆轉輔助系統**

</div>

---

## 📁 專案全貌與模組結構

本專案包含三大主要模組：

```text
c:/project/
├── aura-mobile/       # 📱 React Native (Expo) 行動端 App
├── aura-server/       # 🌐 Node.js WebSocket 開發中繼與除錯伺服器
└── aura-simulator/    # 💻 網頁端感測器控制面板與模擬器
```

### 各模組說明
1. **[aura-mobile](file:///c:/project/aura-mobile)**：
   - 核心行動應用程式，支援 BLE 低功耗藍牙連線與即時感測數據串流。
   - 包含即時儀表板 (ToF 測距 / 空間角速度 / 心率 / 血氧 / 馬達狀態)、行為預警演算法、歷史統計圖表、4-7-8 呼吸引導、白噪音放鬆與替代刺激小遊戲。
2. **[aura-server](file:///c:/project/aura-server)**：
   - 輕量化 Node.js WebSocket 伺服器 (Port 8080)，負責在多裝置與模擬器之間即時廣播感測器 JSON 封包。
3. **[aura-simulator](file:///c:/project/aura-simulator)**：
   - 網頁版感測器控制台 (`index.html`, `dev-tools.html`)，可在無實體硬體的情況下模擬手環數據並廣播給 App。

---

## 🚀 快速啟動指南

### 1. 啟動行動端 App (aura-mobile)
```bash
cd aura-mobile
npm install
npx expo start
```

### 2. 啟動測試伺服器 (aura-server)
```bash
cd aura-server
npm install
node server.js
```

### 3. 啟動感測模擬器 (aura-simulator)
直接以瀏覽器開啟 `aura-simulator/index.html`，即可拖曳滑桿模擬手環動作與生理數據。

---

## 📦 Android APK 打包指令

```bash
cd aura-mobile

# 方法一：EAS 雲端打包 (推薦)
npx eas build -p android --profile preview

# 方法二：本機離線構建
npx expo run:android --variant release
```

詳細說明請參閱 [aura-mobile/README.md](file:///c:/project/aura-mobile/README.md)。
