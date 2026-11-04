# PWA Intranet Testing

## Prerequisites
- Node.js 20+
- npm 10+
- Windows PowerShell
- Test devices on the same private LAN

## Build and serve
```powershell
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Find the PC IPv4 address:
```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress
```

Open `http://<PC-IP>:4173/` from the test device. Permit Node/npm through Windows Firewall only on private networks.

## Script
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pwa-intranet.ps1
```
Optional flags: `-SkipInstall`, `-SkipBuild`, `-StopExisting`, `-Port 4180`.

Validate `/`, `/manifest.webmanifest` and `/sw.js`.

## Limitation
Plain LAN HTTP may not provide a secure context for all service-worker and install flows. Use deployed HTTPS, local HTTPS or `adb reverse` with localhost when testing installability. Never use `npm run dev` as PWA-install evidence.
