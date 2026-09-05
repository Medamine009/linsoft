# Dockerfile - ai-service (assistant IA / chatbot, moteur Google Gemini)
# Build:  mvn clean package -DskipTests   (depuis ce dossier)
# Image:  docker build -t eventify/ai-service:latest .
# Run:    docker run -p 8088:8088 -e GEMINI_API_KEY=xxx eventify/ai-service:latest

FROM eclipse-temurin:17-jre-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY target/ai-service-1.0.0-SNAPSHOT.jar app.jar

RUN chgrp -R 0 /app && chmod -R g=u /app

EXPOSE 8088

ENV JAVA_OPTS="-Xms256m -Xmx512m"

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://localhost:8088/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
