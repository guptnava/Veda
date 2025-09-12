resolvers += Resolver.url("artifactory", url("http://scalasbt.artifactoryonline.com/scalasbt/sbt-plugin-releases"))(Resolver.ivyStylePatterns)

resolvers += "Typesafe Repository" at "http://repo.typesafe.com/typesafe/releases/"

resolvers += "STARC Nexus Repository" at "http://lonpldpuappu4.uk.db.com:8443/nexus/content/groups/starc/"

resolvers += "gm nexus" at "http://gmrepo.gslb.db.com:8481/nexus-webapp/content/groups/gtrepositories/"

//resolvers += Resolver.url("stark ivy", url("http://lonpldpuappu4.uk.db.com:8443/nexus/content/groups/starc/"))(Resolver.ivyStylePatterns)


addSbtPlugin("com.eed3si9n" % "sbt-assembly" % "0.11.2")


addSbtPlugin("com.github.mpeltonen" % "sbt-idea" % "1.6.0")

addSbtPlugin("net.virtual-void" % "sbt-dependency-graph" % "0.7.4")

addSbtPlugin("com.typesafe.sbteclipse" % "sbteclipse-plugin" % "2.4.0")

// Use the Play sbt plugin for Play projects
//addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.2.3")

addSbtPlugin("net.virtual-void" % "sbt-dependency-graph" % "0.7.4")


sbt.ResolveException: unresolved dependency: com.eed3si9n#sbt-assembly;0.14.0: not found
unresolved dependency: net.virtual-void#sbt-dependency-graph;0.7.4: not found
unresolved dependency: com.typesafe.sbteclipse#sbteclipse-plugin;2.4.0: not found
unresolved dependency: de.johoop#ant4sbt;1.1.2: not found
unresolved dependency: com.typesafe.sbt#sbt-native-packager;0.8.0-RC2: not found
unresolved dependency: com.github.gseitz#sbt-release;0.8.5: not found
unresolved dependency: com.github.gseitz#sbt-protobuf;0.4.0: not found
unresolved dependency: org.scala-lang#scala-library;2.10.4: not found
unresolved dependency: org.scala-sbt#sbt;0.13.7: not found
unresolved dependency: org.scala-lang#scala-compiler;2.10.4: not found
