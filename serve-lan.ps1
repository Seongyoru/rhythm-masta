# RHYTHM MASTA LAN server : lets a phone on the same Wi-Fi open the game.
# Uses a plain TCP listener (no admin rights needed). Windows may ask once to allow PowerShell through the firewall.
param([int]$Port = 5180, [switch]$NoOpen)

$root = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$listener = $null
foreach ($p in $Port..($Port + 9)) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $p)
    $l.Start(); $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) {
  Write-Host "Could not open a port ($Port~). Close other programs and try again."
  Read-Host "Press Enter to exit"
  exit 1
}

$ips = @()
try {
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress
} catch {
  $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object { $_.AddressFamily -eq 'InterNetwork' -and -not $_.ToString().StartsWith('127.') } |
    ForEach-Object { $_.ToString() }
}

Write-Host ""
Write-Host "  RHYTHM MASTA (mobile mode) is running."
Write-Host ""
Write-Host "  On this PC   :  http://localhost:$Port/"
foreach ($ip in $ips) { Write-Host "  On your phone:  http://${ip}:$Port/" }
Write-Host ""
Write-Host "  Phone and PC must be on the same Wi-Fi. Keep this window open while playing."
Write-Host ""
if (-not $NoOpen) { Start-Process "http://localhost:$Port/" }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8';
  '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml';
  '.ico' = 'image/x-icon'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'; '.m4a' = 'audio/mp4';
  '.webp' = 'image/webp'; '.woff2' = 'font/woff2'; '.md' = 'text/plain; charset=utf-8'
}
$enc = [System.Text.Encoding]::ASCII

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 4000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, $enc, $false, 4096, $true)
    $line = $reader.ReadLine()
    while ($true) { $h = $reader.ReadLine(); if ($h -eq $null -or $h -eq '') { break } }
    $status = '200 OK'; $ct = 'text/plain; charset=utf-8'; $body = $null
    if ($line -and $line -match '^(GET|HEAD) (\S+)') {
      $path = [Uri]::UnescapeDataString(($Matches[2] -split '\?')[0])
      if ($path -eq '/') { $path = '/index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/'))))
      if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        if ($types[$ext]) { $ct = $types[$ext] } else { $ct = 'application/octet-stream' }
        $body = [IO.File]::ReadAllBytes($file)
      } else { $status = '404 Not Found'; $body = [Text.Encoding]::UTF8.GetBytes('Not found') }
    } else { $status = '400 Bad Request'; $body = [Text.Encoding]::UTF8.GetBytes('Bad request') }
    $head = "HTTP/1.1 $status`r`nContent-Type: $ct`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $hb = $enc.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($line -notmatch '^HEAD') { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
  } catch {
  } finally {
    $client.Close()
  }
}
