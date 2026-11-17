# RHYTHM MASTA local web server (no install needed)
# YouTube embeds do not play from file:// pages, so the game is served from http://localhost.
param([int]$Port = 5180, [switch]$NoOpen)

$root = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$listener = $null
foreach ($p in $Port..($Port + 9)) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
}
if (-not $listener) {
  Write-Host "Could not open a local port ($Port~). Close other programs and try again."
  Read-Host "Press Enter to exit"
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  RHYTHM MASTA is running:  $url"
Write-Host "  Keep this window open while playing. Close it to stop the game server."
Write-Host ""
if (-not $NoOpen) { Start-Process $url }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8';
  '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml';
  '.ico' = 'image/x-icon'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'; '.m4a' = 'audio/mp4';
  '.webp' = 'image/webp'; '.woff2' = 'font/woff2'; '.md' = 'text/plain; charset=utf-8'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq '/') { $path = '/index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/'))))
    if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $res.ContentType = $ct
      $bytes = [IO.File]::ReadAllBytes($file)
    } else {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
    }
    $res.Headers.Add('Cache-Control', 'no-store')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
  } finally {
    $res.Close()
  }
}
