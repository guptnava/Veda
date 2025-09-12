#!/usr/bin/env bash
set -euo pipefail

# Installs third-party/internal jars that are not available on Maven Central
# into your local ~/.m2 repository so the build can proceed.
#
# Looks for jars under api/thirdparty by default. You can also pass explicit
# paths via environment variables.
#
# - OJDBC_JAR: path to Oracle ojdbc6 jar (expects version 11.2.0.2.0)
# - TOMCAT70_JAR: path to com.db.gdauth.tomcat:tomcat70:1.0.1 jar
#
# Example usage:
#   mkdir -p api/thirdparty
#   cp /path/to/ojdbc6.jar api/thirdparty/ojdbc6-11.2.0.2.0.jar
#   cp /path/to/tomcat70-1.0.1.jar api/thirdparty/
#   bash api/install_thirdparty.sh

here="$(cd "$(dirname "$0")" && pwd)"
thirdparty_dir="$here/thirdparty"

mkdir -p "$thirdparty_dir"

ojdbc_default="$thirdparty_dir/ojdbc6-11.2.0.2.0.jar"
tomcat_default="$thirdparty_dir/tomcat70-1.0.1.jar"

OJDBC_JAR_PATH="${OJDBC_JAR:-$ojdbc_default}"
TOMCAT_JAR_PATH="${TOMCAT70_JAR:-$tomcat_default}"

echo "Installing Oracle ojdbc6 (11.2.0.2.0) if present: $OJDBC_JAR_PATH"
if [[ -f "$OJDBC_JAR_PATH" ]]; then
  mvn -B -q install:install-file \
    -Dfile="$OJDBC_JAR_PATH" \
    -DgroupId=com.oracle.oracle \
    -DartifactId=ojdbc6 \
    -Dversion=11.2.0.2.0 \
    -Dpackaging=jar
else
  echo "  Skipped: file not found. Provide OJDBC_JAR env or place jar at $ojdbc_default"
fi

echo "Installing internal tomcat70 (1.0.1) if present: $TOMCAT_JAR_PATH"
if [[ -f "$TOMCAT_JAR_PATH" ]]; then
  mvn -B -q install:install-file \
    -Dfile="$TOMCAT_JAR_PATH" \
    -DgroupId=com.db.gdauth.tomcat \
    -DartifactId=tomcat70 \
    -Dversion=1.0.1 \
    -Dpackaging=jar
else
  echo "  Skipped: file not found. Provide TOMCAT70_JAR env or place jar at $tomcat_default"
fi

echo "Done installing third-party jars to local Maven repo."

