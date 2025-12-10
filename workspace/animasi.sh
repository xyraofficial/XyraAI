#!/bin/bash

echo "Animasi Sederhana"

echo " Loading..."
for i in {1..10}; do
    echo -ne "\rLoading... $i0%"
    sleep 0.5
    if [ $i -eq 5 ]; then
        echo -ne "\rLoading... "
        printf "\\rSelesai!\n"
    fi
done