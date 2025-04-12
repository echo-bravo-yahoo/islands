#!/usr/bin/env bash

res=$(find /mnt/i/games/steam/steamapps -maxdepth 1 -type f -name '*.acf' -exec awk -F '"' '/"appid|name/{ printf $4 "|" } END { print "" }' {} \; | column -t -s '|' | sort -k 2 | grep -i $1)
lineCount=$(wc -l <<< $res)
charCount=$(wc -c <<< $res)
id=$(echo "$res" | head -n 1 | cut -d ' ' -f 1)
gameNames=$(echo "$res" | head -n 20 | cut -d ' ' -f 2- | awk '{$1=$1;print}')

if [[ $lineCount -gt 1 ]]; then
  echo "Too many matching games found:";
  echo "$gameNames";
  exit 2
fi

if [[ $charCount -lt 2 ]]; then
  echo "No matching games found.";
  exit 3
fi

cmd.exe /c start "C:\Program Files (x86)\Steam\steam.exe" steam://rungameid/$id
