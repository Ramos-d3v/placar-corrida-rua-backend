param(
  [string]$BaseUrl = 'http://localhost:3001',
  [string]$IngestionApiKey = $env:INGESTION_API_KEY,
  [int]$IntervalSeconds = 5,
  [int]$Cycles = 0
)

if ([string]::IsNullOrWhiteSpace($IngestionApiKey)) {
  throw 'Informe -IngestionApiKey ou defina a variavel de ambiente INGESTION_API_KEY.'
}

$collection = Join-Path $PSScriptRoot 'results-realtime.postman_collection.json'
$cycle = 0

while ($Cycles -eq 0 -or $cycle -lt $Cycles) {
  $cycle++
  Write-Host "Executando ciclo ${cycle}: dois POSTs de ingestao"

  npx --yes newman run $collection `
    --env-var "baseUrl=$BaseUrl" `
    --env-var "ingestionApiKey=$IngestionApiKey" `
    --iteration-count 1

  if ($LASTEXITCODE -ne 0) {
    throw "Newman falhou no ciclo $cycle com codigo $LASTEXITCODE."
  }

  if ($Cycles -eq 0 -or $cycle -lt $Cycles) {
    Write-Host "Aguardando $IntervalSeconds segundos..."
    Start-Sleep -Seconds $IntervalSeconds
  }
}
