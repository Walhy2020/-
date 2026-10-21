Add-Type -AssemblyName System.Drawing
$taskRoot = 'D:\AI2026\贪吃蛇\research'
$groups = @(
  @(@('tcsdzz','01  贪吃蛇大作战'),@('slither','02  slither.io'),@('snakeio','03  Snake.io'),@('wormszone','04  Worms Zone')),
  @(@('snakeclash','05  Snake Clash!'),@('sssnaker','06  SSSnaker'),@('snakevsblock','07  Snake VS Block'),@('snakebird','08  Snakebird'))
)
$taskFont = New-Object System.Drawing.Font('Microsoft YaHei',20,[System.Drawing.FontStyle]::Bold)
$taskSmall = New-Object System.Drawing.Font('Microsoft YaHei',11)
$taskBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235,240,247))
for($g=0;$g -lt $groups.Count;$g++) {
  $canvas = New-Object System.Drawing.Bitmap(1280,940)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::FromArgb(18,23,32))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawString('SNAKE GAMES  /  贪吃蛇游戏参考图',$taskFont,$taskBrush,24,16)
  for($i=0;$i -lt 4;$i++) {
    $col=$i%2; $row=[math]::Floor($i/2); $x=24+$col*632; $y=72+$row*414
    $graphics.DrawString($groups[$g][$i][1],$taskFont,$taskBrush,$x,$y)
    $imagePath=Join-Path $taskRoot ('screenshots\'+$groups[$g][$i][0]+'.png')
    $sourceImage=[System.Drawing.Image]::FromFile($imagePath)
    $ratio=[math]::Min(600/$sourceImage.Width,350/$sourceImage.Height)
    $width=[int]($sourceImage.Width*$ratio);$height=[int]($sourceImage.Height*$ratio)
    $graphics.DrawImage($sourceImage,[int]($x+(600-$width)/2),[int]($y+44+(350-$height)/2),$width,$height)
    $sourceImage.Dispose()
  }
  $graphics.DrawString('官方商店展示图 · 部分含宣传文字 · 采集于 2026-10-20',$taskSmall,$taskBrush,24,910)
  $canvas.Save((Join-Path $taskRoot ('screenshots\overview-'+($g+1)+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose();$canvas.Dispose()
}
$taskFont.Dispose();$taskSmall.Dispose();$taskBrush.Dispose()
