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
`$host.UI.RawUI.WindowTitle = 'Backend Server'
# Verify .env file exists and has correct path
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found in backend directory - this will cause login issues" -ForegroundColor Red
}
# Start the server in the same directory context (important for .env file path resolution)
uvicorn main:app --reload
"@

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Normal -PassThru

# Minimize the backend window (if desired)
Start-Sleep -Seconds 3
if ($backendProcess -ne $null) {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    
    public class WindowTools {
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@
    [void][WindowTools]::ShowWindow($backendProcess.MainWindowHandle, 6) # 6 is SW_MINIMIZE
}

# Give backend time to start
Start-Sleep -Seconds 5

# Start frontend service in a new PowerShell window
$frontendScript = @"
Set-Location "$frontendDir"
Write-Host "Starting frontend development server..."
`$host.UI.RawUI.WindowTitle = 'Frontend Server'
npm run dev
"@

$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -WindowStyle Normal -PassThru

# Minimize the frontend window (if desired)
Start-Sleep -Seconds 3
if ($frontendProcess -ne $null) {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    
    public class WindowTools {
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@
    [void][WindowTools]::ShowWindow($frontendProcess.MainWindowHandle, 6) # 6 is SW_MINIMIZE
}

# Open Firefox browser to localhost:3000
Start-Sleep -Seconds 5  # Give frontend time to start
if (Test-ProcessRunning -ProcessName "firefox") {
    Start-Process "firefox.exe" -ArgumentList "-new-tab", "http://localhost:3000"
} else {
    Start-Process "firefox.exe" -ArgumentList "http://localhost:3000"
}

Write-Host "Development environment started! Both terminal windows have been minimized."
Write-Host ""
Write-Host "NOTE: If you're having login issues, please check that your .env file exists in the backend directory" -ForegroundColor Yellow
Write-Host "      and contains the necessary connection_string and secret_key values." -ForegroundColor Yellow