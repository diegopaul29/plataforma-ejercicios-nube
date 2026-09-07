#!/usr/bin/env bash

if [ ! -d "jdk-17" ]; then
  echo "Descargando OpenJDK 17 portátil para Render..."
  curl -sL "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz" -o openjdk.tar.gz
  mkdir -p jdk-17
  tar -xzf openjdk.tar.gz -C jdk-17 --strip-components=1
  rm openjdk.tar.gz
  echo "OpenJDK 17 instalado con éxito en la carpeta local jdk-17."
fi