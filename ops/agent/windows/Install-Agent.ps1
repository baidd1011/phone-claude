$TaskName = "phone-claude-agent"
$ProjectRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent | Split-Path -Parent
$EnvScript = Join-Path $PSScriptRoot "agent.env.ps1"
$NpmCommand = "npm run start --workspace @phone-claude/agent"
$Bootstrap = if (Test-Path $EnvScript) {
  ". '$EnvScript'; Set-Location '$ProjectRoot'; $NpmCommand"
} else {
  "Set-Location '$ProjectRoot'; $NpmCommand"
}
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoLogo -NoProfile -WindowStyle Hidden -Command `"$Bootstrap`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Start the phone-claude Windows agent at user logon" -Force
