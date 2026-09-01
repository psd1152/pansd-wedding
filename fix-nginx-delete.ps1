# 给本机 nginx 的 uploads 配置追加 DELETE 方法
$p = 'E:\nginx-1.18.0\conf\nginx.conf'
$c = [IO.File]::ReadAllText($p)
if ($c.Contains('dav_methods PUT;')) {
  $c = $c.Replace('dav_methods PUT;', 'dav_methods PUT DELETE;')
  [IO.File]::WriteAllText($p, $c, (New-Object Text.UTF8Encoding $false))
  Write-Output 'replaced'
} elseif ($c.Contains('dav_methods PUT DELETE;')) {
  Write-Output 'already ok'
} else {
  Write-Output 'pattern not found'
}
& 'E:\nginx-1.18.0\nginx.exe' -p 'E:\nginx-1.18.0' -t
