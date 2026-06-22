$ErrorActionPreference = "Stop"

# 1. Prepare directory
$envDir = Join-Path $PSScriptRoot "python_env"
if (-not (Test-Path $envDir)) {
    New-Item -ItemType Directory -Path $envDir | Out-Null
}

# 2. Download Python Embeddable
$zipPath = Join-Path $envDir "python-3.10.11-embed-amd64.zip"
$pythonExe = Join-Path $envDir "python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "Downloading portable Python 3.10.11 from official site..."
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip" -OutFile $zipPath
    Write-Host "Download complete. Extracting..."
    Expand-Archive -Path $zipPath -DestinationPath $envDir -Force
    Remove-Item $zipPath -Force
} else {
    Write-Host "Portable Python already exists. Skipping download."
}

# 3. Enable site-packages
$pthPath = Join-Path $envDir "python310._pth"
if (Test-Path $pthPath) {
    Write-Host "Configuring Python path (uncomment import site)..."
    (Get-Content $pthPath) -replace '#import site', 'import site' | Set-Content $pthPath
}

# 4. Download and install pip
$getPipScript = Join-Path $envDir "get-pip.py"
if (-not (Test-Path (Join-Path $envDir "Scripts\pip.exe"))) {
    Write-Host "Downloading get-pip.py..."
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPipScript
    Write-Host "Installing pip..."
    & $pythonExe $getPipScript
    Remove-Item $getPipScript -Force
} else {
    Write-Host "pip is already installed. Skipping."
}

# 5. Install project dependencies
Write-Host "Installing project dependencies using Tsinghua mirror..."
$reqFile = Join-Path $PSScriptRoot "backend\requirements.txt"
& $pythonExe -m pip install -r $reqFile -i https://pypi.tuna.tsinghua.edu.cn/simple
& $pythonExe -m pip install pywebview -i https://pypi.tuna.tsinghua.edu.cn/simple

# 6. Run application
Write-Host "Dependencies installed successfully. Starting application..."
$runScript = Join-Path $PSScriptRoot "run_desktop.py"
& $pythonExe $runScript
