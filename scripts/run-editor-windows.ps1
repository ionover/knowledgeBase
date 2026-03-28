$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path "$PSScriptRoot\..")

pip install --user -r requirements.txt
python app.py

