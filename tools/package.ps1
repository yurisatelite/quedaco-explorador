$ErrorActionPreference = 'Stop'
$explorerRoot = Split-Path $PSScriptRoot -Parent
$explorerOutput = Join-Path $explorerRoot 'dist'
New-Item -ItemType Directory -Force $explorerOutput | Out-Null
$explorerFiles = @('module.json', 'src', 'styles', 'templates', 'docs', 'README.md', 'CHANGELOG.md') | ForEach-Object { Join-Path $explorerRoot $_ }
Compress-Archive -LiteralPath $explorerFiles -DestinationPath (Join-Path $explorerOutput 'quedaco-explorador.zip') -Force
Copy-Item -LiteralPath (Join-Path $explorerRoot 'module.json') -Destination (Join-Path $explorerOutput 'module.json')
Write-Output (Join-Path $explorerOutput 'quedaco-explorador.zip')
