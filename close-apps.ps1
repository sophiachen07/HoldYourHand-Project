$processesToClose = @(
    "chrome",
    "msedge",
    "Steam",
    "SteamService",
    "steamwebhelper",
    "Teams",
    "LineCall",
    "LINE",
    "LineMediaPlayer",
    "OneDrive"
)

foreach ($proc in $processesToClose) {
    Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "已嘗試關閉: $proc"
}

Write-Host "完成,可以開始跑 npx expo start -c 了"