FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --create-home promora
WORKDIR /app
COPY --from=build /app/target/promora-backend-*.jar app.jar
RUN mkdir -p /app/data/uploads && chown -R promora /app
USER promora
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s CMD wget -qO- http://localhost:8080/actuator/health | grep -q UP || exit 1
ENTRYPOINT ["java", "-Duser.timezone=UTC", "-jar", "app.jar"]
