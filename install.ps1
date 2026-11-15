# Aurabot QQ 抖音增强版 — 安装脚本（Windows PowerShell）
# 做法：先备份 Aurabot 配置 + 抖音模块数据，再把增强版装进社区模块目录。
# 任何一步失败就回滚备份，不动原版。装之前请先关掉 DSH。
# 用法：右键 → 使用 PowerShell 运行，或在 PowerShell 里：.\install.ps1

$ErrorActionPreference = 'Stop'
$ModuleDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AurabotData = Join-Path $env:USERPROFILE '.dsh\plugins-data\aurabot'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $AurabotData "backups\douyin-plus-$Stamp"

if (-not (Test-Path $AurabotData)) {
  Write-Host "没找到 Aurabot 数据目录：$AurabotData" -ForegroundColor Red
  Write-Host '先确认 DSH 和 Aurabot 装在这台电脑上，再跑这个脚本。'
  exit 1
}

Write-Host "备份到：$BackupDir"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$backedUp = @()
foreach ($name in @('config.json', 'douyin.json', 'douyin-plus-people.json', 'douyin-plus-quotas.json')) {
  $src = Join-Path $AurabotData $name
  if (Test-Path $src) { Copy-Item $src (Join-Path $BackupDir $name); $backedUp += $name }
}
$oldModule = Join-Path $AurabotData 'modules\douyin'
if (Test-Path $oldModule) {
  Copy-Item $oldModule (Join-Path $BackupDir 'douyin-module') -Recurse
  $backedUp += 'modules\douyin'
}
Write-Host "已备份：$($backedUp -join ', ')"

try {
  $dest = Join-Path $AurabotData 'modules\douyin-plus'
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item (Join-Path $ModuleDir 'index.mjs') $dest
  Copy-Item (Join-Path $ModuleDir 'module.json') $dest
  Copy-Item (Join-Path $ModuleDir 'lib') (Join-Path $dest 'lib') -Recurse
  Copy-Item (Join-Path $ModuleDir 'README.md') $dest
  Write-Host '增强版已装好。下一步：打开 DSH → Aurabot 面板 → 开「刷抖音增强版」→ 扫码登录抖音 → 白名单里加人。' -ForegroundColor Green
} catch {
  Write-Host "安装失败，正在回滚：$($_.Exception.Message)" -ForegroundColor Red
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
  foreach ($name in $backedUp) {
    $src = Join-Path $BackupDir $name
    if (Test-Path $src) { Copy-Item $src (Join-Path $AurabotData $name) -Recurse -Force }
  }
  Write-Host "已回滚到安装前状态，备份在：$BackupDir"
  exit 1
}
