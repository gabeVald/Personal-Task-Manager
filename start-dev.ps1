# Script to start Personal Task Manager development environment
# Save as start-dev.ps1

# Function to check if a process is running
function Test-ProcessRunning {
    param($ProcessName)
    $process = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    return $null -ne $process
}

# Get the root directory (assuming script is in the project root)
$rootDir = $PSScriptRoot
$backendDir = Join-Path $rootDir "personal-task-manager/backend"
$frontendDir = Join-Path $rootDir "personal-task-manager"

# Start backend service in a new PowerShell window
$backendScript = @"
Set-Location "$backendDir"
Write-Host "Activating virtual environment..."
.\\venv\\Scripts\\Activate.ps1
Write-Host "Starting backend server..."
uvicorn main:app --reload
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Normal

# Give backend time to start
Start-Sleep -Seconds 5

# Start frontend service in a new PowerShell window
$frontendScript = @"
Set-Location "$frontendDir"
Write-Host "Starting frontend development server..."
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WindowStyle Normal

# Open Firefox browser to localhost:3000
Start-Sleep -Seconds 5  # Give frontend time to start
if (Test-ProcessRunning -ProcessName "firefox") {
    Start-Process "firefox.exe" -ArgumentList "-new-tab", "http://localhost:3000"
} else {
    Start-Process "firefox.exe" -ArgumentList "http://localhost:3000"
}

Write-Host "Development environment started!"