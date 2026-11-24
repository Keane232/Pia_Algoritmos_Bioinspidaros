$port = 3000
$root = "c:\Users\carlo\OneDrive\Desktop\Pia_AB"
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "Server running on http://localhost:$port"

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $requestLine = $reader.ReadLine()
        if ($requestLine) {
            $tokens = $requestLine.Split(' ')
            if ($tokens.Length -ge 2) {
                $path = $tokens[1]
                if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
                $cleanPath = $path.Split('?')[0].TrimStart('/').Replace('/', '\')
                $filePath = Join-Path $root $cleanPath

                if (Test-Path $filePath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = "text/plain"
                    if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
                    elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
                    elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
                    elseif ($ext -eq ".json") { $contentType = "application/json; charset=utf-8" }
                    elseif ($ext -eq ".png") { $contentType = "image/png" }
                    elseif ($ext -eq ".svg") { $contentType = "image/svg+xml" }

                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                } else {
                    $msg = "404 Not Found"
                    $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($msg.Length)`r`nConnection: close`r`n`r`n$msg"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                }
            }
        }
        $stream.Flush()
        $client.Close()
    } catch {
        Write-Warning $_.Exception.Message
    }
}
$listener.Stop()
