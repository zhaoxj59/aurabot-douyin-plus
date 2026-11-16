# Aurabot QQ 抖音增强版 — 卸载脚本（Windows PowerShell）
# 做法：删掉增强版模块，恢复 install.ps1 当时做的备份，回到原版状态。
# 用法：.\uninstall.ps1 -BackupDir 'C:\Users\Administrator\.dsh\plugins-data\aurabot\backups\douyin-plus-20261115-xxxxxx'

param([string]$BackupDir = '')
$ErrorActionPreference = 'Stop'
$AurabotData = Join-Path $env:USERPROFILE '.dsh\plugins-data\aurabot'

if (-not $BackupDir) {
  $latest = Get-ChildItem (Join-Path $AurabotData 'backups') -Directory -Filter 'douyin-plus-*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { Write-Host '没找到备份目录，删不了也恢复不了。先确认备份在不在。' -ForegroundColor Red; exit 1 }
  $BackupDir = $latest.FullName
}
Write-Host "用这个备份恢复：$BackupDir"
$dest = Join-Path $AurabotData 'modules\douyin-plus'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force; Write-Host '增强版模块已删除。' }
foreach ($name in @('config.json', 'douyin.json', 'douyin-plus-people.json', 'douyin-plus-quotas.json')) {
  $src = Join-Path $BackupDir $name
  if (Test-Path $src) { Copy-Item $src (Join-Path $AurabotData $name) -Force; Write-Host "已恢复：$name" }
}
$oldModule = Join-Path $BackupDir 'douyin-module'
if (Test-Path $oldModule) {
  Copy-Item $oldModule (Join-Path $AurabotData 'modules\douyin') -Recurse -Force
  Write-Host '原版抖音模块已恢复。'
}
Write-Host '卸载完成，已回到安装前状态。重启一次 DSH 生效。' -ForegroundColor Green
