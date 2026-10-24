$ErrorActionPreference = 'Stop'
$fixtureDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) '.cache'
New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(1000,250)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$font = New-Object System.Drawing.Font('Arial',22)
try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.DrawString('Fictional demonstration only.', $font, [System.Drawing.Brushes]::Black, 25, 25)
    $graphics.DrawString('The sample counter was closed on Monday.', $font, [System.Drawing.Brushes]::Black, 25, 80)
    $graphics.DrawString('Please publish the opening hours.', $font, [System.Drawing.Brushes]::Black, 25, 135)
    $bitmap.Save((Join-Path $fixtureDirectory 'b02-image-text.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $font.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
