$ErrorActionPreference = "Stop"

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment python was not found at $venvPython"
}

& $venvPython -m pip install -r (Join-Path $PSScriptRoot "requirements.txt")
