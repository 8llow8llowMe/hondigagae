# Local Run Guide

로컬에서 백엔드를 띄우는 절차. 모든 서비스는 `local` 프로파일이 기본이며, 외부 자격증명 없이도 기동된다.

## 1. 사전 준비

- JDK 21 (Gradle toolchain 이 21을 요구한다)
- Docker (미들웨어용)

## 2. 미들웨어 기동

```bash
cd backend
docker compose -f docker-compose-local.yml up -d
```

MySQL(3306, DB `hondigagae`, 계정 `hondigagae` / `hondigagae123!`)과 Redis(6379)가 뜬다.
local 프로파일 기본값이 이 값에 맞춰져 있어 별도 설정이 필요 없다.

## 3. 기동 순서

의존 순서상 **service-discovery → 나머지 서비스 → api-gateway** 순으로 띄운다.

```bash
./gradlew :cloud:service-discovery:bootRun     # 8761
./gradlew :service:auth-service:bootRun        # 8081
./gradlew :service:tour-service:bootRun        # 8082
./gradlew :service:plan-service:bootRun        # 8083
./gradlew :service:ai-service:bootRun          # 8085
./gradlew :cloud:api-gateway:bootRun           # 8000
```

배치는 상시 기동 대상이 아니다 (§6 참고).

## 4. 로컬 포트 / 프로파일 포트

| 모듈 | local | dev | prod |
|------|-------|-----|------|
| service-discovery | 8761 | 6761 | 9761 |
| api-gateway | 8000 | 6000 | 9000 |
| batch-service | 8080 | 6080 | 9080 |
| auth-service | 8081 | 6081 | 9081 |
| tour-service | 8082 | 6082 | 9082 |
| plan-service | 8083 | 6083 | 9083 |
| ai-service | 8085 | 6085 | 9085 |

dev/prod 포트는 인프라 레포의 대역 규칙(dev `6xxx`, prod `9xxx`)을 따른다.

## 5. Swagger

- 통합 UI: <http://localhost:8000/swagger-ui.html> (게이트웨이가 4개 서비스 문서를 집계)
- 개별 서비스: `http://localhost:{포트}/swagger-ui.html`
- prod 프로파일에서는 `*SwaggerConfig` 가 `@Profile("!prod")` 라 문서가 노출되지 않는다.

## 6. 배치 실행

batch-service 는 상시 기동이 아니라 파라미터를 주고 실행하는 잡이다.

```bash
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=placeImportJob areaCode=39"
```

`TOUR_API_SERVICE_KEY` 환경변수가 필요하다 (공공데이터포털 인증키, 커밋 금지).

```bash
# Windows PowerShell
$env:TOUR_API_SERVICE_KEY = "<디코딩된 인증키>"
```

## 7. 자주 겪는 문제

- **`jwtDecoder` NPE 로 기동 실패** — Resource Server 서비스(tour/plan/ai)의 검증 키 prefix 는
  `app.security.jwt.resource.access-key` 다. auth-service 의 발급 키(`jwt.access-key`)와
  이름이 다르지만 **값은 반드시 같아야** 한다. local 기본값은 이미 맞춰져 있다.
- **Config Server 연결 거부 로그** — `spring-cloud-starter-bootstrap` 이 bootstrap 단계에서
  `localhost:8888` 을 먼저 찾는다. 경고일 뿐 기동에는 영향이 없다.
- **Eureka 연결 거부 로그** — service-discovery 를 먼저 띄우지 않으면 나온다. 재시도하므로
  나중에 띄워도 자동으로 등록된다.
- **Gradle 데몬 크래시** — 기본 힙으로는 데몬이 죽은 이력이 있어 `gradle.properties` 에서
  `-Xmx2g` 로 올려 두었다. 이 파일을 지우지 말 것.
