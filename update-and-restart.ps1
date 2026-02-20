param(
  [string]$Branch = "main"
)

Set-Location -Path $PSScriptRoot

git fetch origin
git checkout $Branch
git pull --ff-only origin $Branch
npm install --omit=dev
pm2 restart attendpro
