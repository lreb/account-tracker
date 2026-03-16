# PWA Intranet Publish Manual

This guide explains how to build the app as a production PWA and expose it inside your local network (intranet) for device testing.

## 1) Prerequisites

- Node.js 20+
- npm 10+
- Same Wi-Fi/LAN for PC and mobile devices
- Windows PowerShell

## 2) Manual one-time commands

Run from project root:

```powershell
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

What this does:

- `build`: creates optimized production files in `dist/`
- `preview --host 0.0.0.0`: binds server to all local interfaces so devices in intranet can access it

## 3) Access from phone (Android)

1. On your PC, get local IPv4:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress
```

2. Open on Android browser (same Wi-Fi):

```text
http://<YOUR_PC_IP>:4173/
```

Example:

```text
http://192.168.100.125:4173/
```

## 4) Reusable script (recommended)

Use the script:

- `scripts/publish-pwa-intranet.ps1`

Run it from project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pwa-intranet.ps1
```

Useful options:

```powershell
# Keep existing node_modules and only build + publish
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pwa-intranet.ps1 -SkipInstall

# Reuse previous dist build and only publish
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pwa-intranet.ps1 -SkipInstall -SkipBuild

# Force-kill any previous server on same port
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pwa-intranet.ps1 -StopExisting

# Custom port
powershell -ExecutionPolicy Bypass -File .\scripts\publish-pwa-intranet.ps1 -Port 4180
```

The script automatically validates these endpoints:

- `/`
- `/manifest.webmanifest`
- `/sw.js`

## 5) Firewall and network notes

- If phone cannot connect, allow Node.js or npm through Windows Firewall for private networks.
- Ensure both devices are in the same subnet and no AP/client isolation is enabled on the router.

## 6) PWA install/offline caveat on LAN HTTP

- Some browsers limit full service worker/PWA install features on plain HTTP LAN URLs.
- If install/offline is limited, use one of these:
  - local HTTPS for preview
  - `adb reverse` and use `http://localhost:<port>` on Android WebView/testing flows

## 7) Stop published server

If started with the script, it prints the process ID. Stop with:

```powershell
Stop-Process -Id <PID> -Force
```
