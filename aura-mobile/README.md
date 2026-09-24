# Hold Your Hand (Aura) - BFRB 智慧穿戴與習慣逆轉輔助系統

<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![BLE](https://img.shields.io/badge/Bluetooth-BLE_4.0+-0082FC?style=for-the-badge&logo=bluetooth&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-brightgreen?style=for-the-badge)

<br />

**專為「身體專注重複行為 (BFRB)」打造的智慧穿戴感測監控、即時中斷介入與習慣逆轉輔助系統**

[功能特色](#核心功能特色) • [系統架構](#系統架構與技術選型) • [BLE 通訊協議](#ble-藍牙通訊協議) • [快速開始](#快速上手指南) • [打包發布](#android-apk-打包指南)

</div>

---

## 專案簡介

Hold Your Hand (Aura) 是一套結合智慧穿戴手環硬體與行動端 App 的數位健康輔助系統。

身體專注重複行為（BFRB, Body-Focused Repetitive Behaviors，如拔毛症 Trichotillomania、咬指甲 Onychophagia、摳皮症 Excoriation 等）往往發生在無意識狀態、壓力焦慮或無聊缺乏刺激的情境中。

本系統透過手環硬體上的高頻感測器（ToF 距離感測器、空間陀螺儀、心率與血氧感測模組），即時捕捉並判定肢體異常靠近頭部/目標區域的動作軌跡：
1. 即時觸覺中斷：在手指即將觸碰目標區域瞬間，手環發出震動提示，喚醒使用者的當下意識。
2. 多維數據監控：App 即時接收並視覺化呈現生理與動作數據。
3. 習慣逆轉介入 (HRT)：提供 4-7-8 呼吸放鬆練習、環境白噪音與指尖替代刺激小遊戲，協助使用者平復焦慮、轉移手部衝動。
4. 長期行為分析：統計日、週、月、年行為頻次與誘發因子，掌握戒斷與改善進程。

---

## 核心功能特色

### 1. 即時感測儀表板 (Real-time Dashboard)
- 多維度感測指標監控：
  - ToF 測距 (Distance)：即時公釐 (mm) 級距偵測，評估手部與目標區域距離。
  - 空間角速度 (Angular Velocity)：3 軸空間向量模長計算，即時追蹤舉手與擺動動態。
  - 心率 (Heart Rate BPM) 與血氧 (SpO2 %)：監控生理緊張度與自律神經狀態。
  - 馬達震動狀態：即時回饋手環觸覺致動器狀態。
- 高頻資料節流引擎：90ms Throttle 機制 (~11 FPS 順暢更新)，確保 React Native UI 絲滑流暢不卡頓。

### 2. 智慧行為預警與中斷介入 (Real-time Alert & Intervention)
- 雙重動作判定演算法：結合空間角速度峰值與距離閾值，精準識別 BFRB 觸發行為。
- 即時警示彈窗與震動：手環與手機雙端觸覺回饋，第一時間中斷無意識行為。
- 即刻轉移引導：一鍵導流至「放鬆呼吸」或「舒壓小遊戲」。

### 3. 深度統計與行為數據分析 (Statistics & Analytics)
- 視覺化趨勢圖表：日、週、月、年行為次數長條圖與折線圖 (基於 React Native SVG)。
- 行為時段熱點分析：統計行為高發時段（早晨、午後、深夜等）。
- 誘發因子追蹤：分類統計驅動原因（壓力焦慮、無聊/缺乏刺激、注意力缺失、觸感不平整等）。
- 成就與戒斷天數 (Streak)：記錄連續無發作天數與成功中斷次數，建立正向心理激勵。

### 4. 舒壓放鬆與正念導引 (Relax & Mindfulness)
- 動態呼吸引導：視覺化 4-7-8 吸氣/吐氣節奏動畫，引導深呼吸舒緩緊張。
- 高品質環境白噪音：內建正念靜心、舒緩海浪、自然雨聲，支援無縫循環播放與獨立音量調節。

### 5. 指尖替代刺激小遊戲 (Tactile Replacement Game)
- 習慣替代療法 (Habit Reversal Therapy)：專為轉移手部摳抓衝動設計的幾何擴張小遊戲。
- 豐富觸覺反饋：整合 expo-haptics 震動回饋與動態幾何粒子特效，提供良性觸覺刺激。

### 6. 雙模連線支援 (Dual Connection Modes)
- 硬體 BLE 模式：支援低功耗藍牙 (BLE) 自動掃描、配對與 Base64 CSV 封包即時串流解析。
- 模擬器 WebSocket 模式：無實體手環時，可無縫切換至本機 WebSocket 伺服器與網頁模擬器進行全功能測試。

---

## 系統架構與技術選型

```mermaid
graph TD
    subgraph Hardware Layer
        ESP32[ESP32 Wearable Device]
        ToF[ToF Distance Sensor] --> ESP32
        IMU[6-Axis Gyro / Accel] --> ESP32
        PPG[Heart Rate & SpO2 PPG] --> ESP32
        Motor[Haptic Vibration Motor] <-- ESP32
    end

    subgraph Communication Layer
        ESP32 -->|BLE GATT Notification| BLE[react-native-ble-plx]
        Sim[Web Simulator / Dev Tools] -->|WebSocket| WS[Node.js WebSocket Server]
    end

    subgraph Mobile App Client [Hold Your Hand App]
        BLE --> SensorContext[Sensor Context]
        WS --> SensorContext
        SensorContext --> AlertContext[Alert & Algorithm Engine]
        SensorContext --> UserContext[User & History Storage]
        
        AlertContext --> UI_Dash[即時儀表板 Dashboard]
        AlertContext --> UI_Alert[警示與中斷 Modal]
        UserContext --> UI_Stats[統計分析 Statistics]
        UI_Dash --> UI_Relax[放鬆導引 Relax]
        UI_Dash --> UI_Game[舒壓遊戲 Game]
    end
```

### 技術選型
| 領域 | 使用技術 |
| :--- | :--- |
| 核心框架 | React Native 0.86.3, Expo SDK 57, TypeScript 5.0+ |
| 路由與導航 | Expo Router (File-based Routing, Typed Routes) |
| 藍牙通訊 | react-native-ble-plx |
| 觸覺與多媒體 | expo-haptics, expo-audio |
| 圖表與動畫 | react-native-svg, react-native-reanimated, expo-linear-gradient |
| 本機資料儲存 | @react-native-async-storage/async-storage |
| 圖標庫 | lucide-react-native |
| 開發與模擬伺服器 | Node.js, ws WebSocket Server, HTML5 Canvas Simulator |

---

## BLE 藍牙通訊協議 (BLE Hardware Protocol)

App 與 ESP32 智慧手環透過以下 GATT 服務與特徵值進行數據通訊：

- 目標裝置名稱 (Device Name)：`HoldYourHand_Device`
- 服務 UUID (Service UUID)：`4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- 特徵值 UUID (Characteristic UUID)：`beb5483e-36e1-4688-b7f5-ea07361b26a8`

### 封包資料格式 (Packet Format)
手環發送 Base64 編碼的 CSV 字串：
`Base64("距離,角速度,心率,血氧,馬達狀態")`

**欄位定義說明：**
| 欄位順序 | 欄位名稱 | 單位 / 型態 | 說明 |
| :---: | :--- | :--- | :--- |
| 1 | distance | int (mm) | 距離數值，9999 以上代表超出感應範圍 |
| 2 | angularVelocity | float (deg/s) | 空間角速度向量模長 |
| 3 | heartRate | float (BPM) | 即時心率 |
| 4 | spo2 | int (%) | 即時血氧飽和度 |
| 5 | motorStatus | int (0 或 1) | 1 為馬達震動中，0 為待機/冷卻 |

- 封包範例：原始字串 `45,32.4,84.2,98,1` 編碼為 Base64 字串 `NDUsMzIuNCw4NC4yLDk4LDE=`

---

## 專案目錄結構 (Project Structure)

```text
aura-mobile/
├── app/                        # Expo Router 頁面路由
│   ├── _layout.tsx             # 根佈局與 Context Provider 注入
│   ├── (tabs)/                 # 底部導航分頁
│   ├── dashboard.tsx           # 即時感測數據儀表板與統計圖表頁
│   ├── device.tsx              # 藍牙配對 / 模擬器切換管理頁
│   ├── relax.tsx               # 4-7-8 呼吸導引與白噪音放鬆頁
│   ├── game.tsx                # 指尖替代刺激小遊戲
│   ├── profile.tsx             # 個人 BFRB 類型與驅動因子設定
│   └── settings.tsx            # 靈敏度與通知偏好設定
├── assets/                     # 靜態資源 (圖示、無版權音效 musics/)
├── components/                 # 共用 UI 元件 (Alert Modal、ThemedView 等)
├── constants/                  # 色彩主題 (auraTheme.ts)
├── contexts/                   # 核心全域狀態管理
│   ├── AlertContext.tsx        # 即時行為判定與警示狀態
│   ├── SensorContext.tsx       # BLE / WebSocket 感測數據流與節流處理
│   └── UserContext.tsx         # 使用者偏好、歷史統計資料庫與時區工具
├── hooks/                      # 自訂 React Hooks
├── services/                   # 底層通訊服務
│   └── bleService.ts           # BLE 藍牙連線、權限申請與封包解析
├── types/                      # TypeScript 型別定義 (sensor.ts 等)
├── app.json                    # Expo 與 EAS 應用設定檔
├── eas.json                    # EAS 雲端建置配置
├── package.json                # 專案依賴管理
└── tsconfig.json               # TypeScript 編譯配置
```

---

## 快速上手指南 (Getting Started)

### 1. 前置需求 (Prerequisites)
- Node.js (建議 v18 或以上版本)
- npm 或 yarn
- 手機安裝 Expo Go (適用於介面與模擬測試) 或 Development Build / 實機 APK (適用於原生藍牙 BLE 測試)

### 2. 安裝依賴 (Installation)
```bash
cd aura-mobile
npm install
```

### 3. 啟動開發伺服器 (Start Expo Server)
```bash
npx expo start
```
- 按 a 可在已連線的 Android 模擬器/實機開啟。
- 按 i 可在 iOS 模擬器開啟。
- 使用手機相機或 Expo Go 掃描終端機中的 QR Code 進行即時預覽。

---

## 搭配模擬器與後端測試 (Simulator & Server)

本專案支援免硬體全功能模擬除錯：

1. 啟動 WebSocket 中繼伺服器：
   ```bash
   cd ../aura-server
   npm install
   node server.js
   ```
   伺服器將在 `ws://localhost:8080` 啟動監聽。

2. 開啟網頁模擬器：
   - 使用瀏覽器開啟 `aura-simulator/index.html` 或 `aura-simulator/dev-tools.html`。
   - 於面板中自由調整距離、角速度、心率與血氧滑桿，即時將數據廣播至 App。

3. App 切換至模擬器模式：
   - 進入 App 的「裝置」頁面 (`/device`)，切換為「模擬器模式」即可接收即時推播。

---

## Android APK 打包指南 (Build APK)

### 方法一：EAS 雲端打包 (推薦，免本機 Android SDK)
直接透過 Expo Application Services (EAS) 雲端生成 `.apk` 安裝檔：
```bash
# 登入 EAS 帳號 (首次需登入)
npx eas login

# 觸發 Android Preview APK 雲端建置
npx eas build -p android --profile preview
```
建置完成後終端機會提供直接下載 `.apk` 的網址與 QR Code。

### 方法二：本機離線構建 (需已配置 Android SDK & Java JDK)
```bash
npx expo run:android --variant release
```

---

## Git 推送與提交說明 (Push to GitHub)

如需將專案更新推送到遠端 GitHub 儲存庫：

```bash
# 1. 檢查當前狀態
git status

# 2. 加入所有變更
git add .

# 3. 建立 Commit 訊息
git commit -m "docs: update comprehensive project README without emojis"

# 4. 推送至 GitHub main 分支
git push origin main
```

---

## 授權條款 (License)

本專案採用 MIT License 開源授權。
