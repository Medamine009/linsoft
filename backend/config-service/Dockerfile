# Dockerfile - config-service (Spring Cloud Config Server)
# Prérequis : mvn package (le jar doit exister dans target/)
FROM eclipse-temurin:17-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY target/config-service-1.0.0-SNAPSHOT.jar app.jar

RUN chgrp -R 0 /app && chmod -R g=u /app

EXPOSE 8888

ENV JAVA_OPTS="-Xms256m -Xmx512m"

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=6 \
  CMD curl -fsS http://localhost:8888/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
