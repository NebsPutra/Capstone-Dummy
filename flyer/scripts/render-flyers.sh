#!/bin/sh
# Renders the HTML flyers and the logo to PNG with headless Google Chrome (2x scale).
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(pwd)"

render() { # html  output.png  width,height
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --virtual-time-budget=6000 --window-size="$3" --screenshot="$DIR/$2" "file://$DIR/$1" >/dev/null 2>&1
  echo "rendered $2"
}

render flyer.html capstone-a-team-flyer.png 1080,1350
render threads-flyer.html komunitas-threads-flyer.png 1080,1350

printf '<!doctype html><html><body style="margin:0;background:transparent">%s</body></html>' "$(cat a-team-logo.svg)" > .logo.html
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --window-size=512,512 --screenshot="$DIR/a-team-logo.png" "file://$DIR/.logo.html" >/dev/null 2>&1
rm -f .logo.html
echo "rendered a-team-logo.png"
