#!/usr/bin/env bash
set -euo pipefail

# Downloads jars referenced by the converted Maven build (runtime deps)
# and the original SBT plugins into api/target/.

here="$(cd "$(dirname "$0")" && pwd)"
out_lib="$here/target/lib-deps"
out_plugins="$here/target/sbt-plugins"
mkdir -p "$out_lib" "$out_plugins"

echo "[1/2] Resolving and copying application dependencies to $out_lib (public repos only)"
# Copy runtime-scope deps (includes compile and runtime)
mvn -f "$here/pom.xml" -B -q \
  dependency:copy-dependencies \
  -DincludeScope=runtime \
  -DoutputDirectory="$out_lib" \
  -Pwith-spark

# Optionally include test-scoped deps as well
if [[ "${TEST_DEPS:-}" == "1" ]]; then
  echo "Including test-scoped dependencies as requested"
  mvn -f "$here/pom.xml" -B -q \
    dependency:copy-dependencies \
    -DincludeScope=test \
    -DoutputDirectory="$out_lib" \
    -DoverWriteReleases=true -DoverWriteSnapshots=true -DoverWriteIfNewer=true \
    -Pwith-spark
fi

echo "[2/2] Fetching SBT plugin jars into $out_plugins (public SBT repo)"

# SBT plugin cross versions that match the legacy build (Scala 2.10, SBT 0.13)
SCALA_BIN="2.10"
SBT_BIN="0.13"
REMOTE_REPOS="https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases,https://repo1.maven.org/maven2"

declare -a PLUGINS=(
  "com.eed3si9n:sbt-assembly_${SCALA_BIN}_${SBT_BIN}:0.11.2"
  "com.github.mpeltonen:sbt-idea_${SCALA_BIN}_${SBT_BIN}:1.6.0"
  "net.virtual-void:sbt-dependency-graph_${SCALA_BIN}_${SBT_BIN}:0.7.4"
  "com.typesafe.sbteclipse:sbteclipse-plugin_${SCALA_BIN}_${SBT_BIN}:2.4.0"
)

for coords in "${PLUGINS[@]}"; do
  echo "- Resolving $coords"
  mvn -B -q org.apache.maven.plugins:maven-dependency-plugin:3.6.1:get \
    -Dartifact="$coords" \
    -DremoteRepositories="$REMOTE_REPOS" || true

  echo "  Copying $coords to $out_plugins"
  mvn -B -q org.apache.maven.plugins:maven-dependency-plugin:3.6.1:copy \
    -Dartifact="$coords" \
    -DoutputDirectory="$out_plugins" \
    -DoverWriteReleases=true -DoverWriteSnapshots=true -DoverWriteIfNewer=true || true
done

echo "Done."

echo "Locations:"
echo "- Application deps: $out_lib"
:
echo "- SBT plugin jars: $out_plugins"

cat <<EONOTE
Notes:
- This script avoids proprietary/internal dependencies by default.
- To include non-public dependencies (Oracle JDBC, Lightbend Slick Extensions, internal tomcat), enable the Maven profile 'nonpublic' and ensure you have access:
    mvn -f "$here/pom.xml" -Pnonpublic -U clean package
- Set EXCLUDE_SPARK=1 to flip Spark/Hadoop to 'provided' scope per the original SBT logic.
- Set TEST_DEPS=1 to also copy test-scoped dependencies.
EONOTE
