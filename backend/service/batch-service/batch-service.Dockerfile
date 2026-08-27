# 라즈베리파이 ARM64 호환 JRE 21
# (배포 대상 main-server / backend-1 이 aarch64 다. 빌더는 x86_64 이지만 JAR 은 아키텍처 무관이다)
FROM ibm-semeru-runtimes:open-21-jre-jammy

# Jenkins 에서 사전 빌드된 JAR 복사
# (`./gradlew :service:batch-service:bootJar` 산출물을 배포 에이전트가 app.jar 로 배치한 것)
ARG JAR_FILE=./app.jar
COPY ${JAR_FILE} /app/batch-service.jar

# 컨테이너 메모리 인식 + heap 70% 상한, 시간대 / 프로파일 환경변수 주입
ENTRYPOINT ["sh", "-c", "java \
  -Duser.timezone=$TIME_ZONE \
  -Dspring.profiles.active=$SPRING_PROFILES_ACTIVE \
  -XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=70.0 \
  -XX:InitialRAMPercentage=30.0 \
  -jar /app/batch-service.jar"]
