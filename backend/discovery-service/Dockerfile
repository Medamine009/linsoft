# Dockerfile - discovery-service
# Build:  mvn clean package -DskipTests   (depuis ce dossier)
# Image:  docker build -t eventify/discovery-service:latest .
# Run:    docker run -p 8761:8761 eventify/discovery-service:latest

FROM eclipse-temurin:17-jre-alpine

# curl pour les health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copie du JAR Spring Boot (genere par mvn package)
COPY target/discovery-service-1.0.0-SNAPSHOT.jar app.jar

# Bonne pratique OpenShift : groupe root (gid 0) avec acces au /app
# (OpenShift assigne un UID aleatoire dans le groupe 0)
RUN chgrp -R 0 /app && chmod -R g=u /app

EXPOSE 8761

# Options JVM surchargeables via env var
ENV JAVA_OPTS="-Xms256m -Xmx512m"

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://localhost:8761/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]