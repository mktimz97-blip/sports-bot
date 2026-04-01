# RuFlo V3.5 — Setup Ollama + Qwen 3.5 (Local LLM)
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-ollama-qwen.ps1

Write-Host "=== RuFlo: Setup Local LLM (Qwen 3.5 via Ollama) ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Ollama is installed
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    Write-Host "[1/3] Ollama not found. Installing..." -ForegroundColor Yellow
    Write-Host "  Downloading from https://ollama.com/download/windows..." -ForegroundColor Gray

    $installerUrl = "https://ollama.com/download/OllamaSetup.exe"
    $installerPath = "$env:TEMP\OllamaSetup.exe"

    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "  Running installer..." -ForegroundColor Gray
    Start-Process -FilePath $installerPath -Wait
    Write-Host "  [OK] Ollama installed." -ForegroundColor Green
} else {
    Write-Host "[1/3] Ollama already installed: $($ollama.Source)" -ForegroundColor Green
}

# Step 2: Start Ollama service
Write-Host "[2/3] Starting Ollama service..." -ForegroundColor Yellow
Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host "  [OK] Ollama service running on http://localhost:11434" -ForegroundColor Green

# Step 3: Pull Qwen model
Write-Host "[3/3] Pulling Qwen 3 model (8B)..." -ForegroundColor Yellow
Write-Host "  This may take 5-10 minutes on first run..." -ForegroundColor Gray
ollama pull qwen3:8b

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Available models:" -ForegroundColor Cyan
ollama list

Write-Host ""
Write-Host "Test: ollama run qwen3:8b 'Hello, write a TypeScript function'" -ForegroundColor Gray
Write-Host "API:  curl http://localhost:11434/api/generate -d '{\"model\":\"qwen3:8b\",\"prompt\":\"Hello\"}'" -ForegroundColor Gray
