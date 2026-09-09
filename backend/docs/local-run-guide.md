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

MySQL(3306, DB `hondigagae`, 계정 `hondigagae` / `hondigagae123!`), Redis(6379),
MinIO(9000, 콘솔 9001, `minioadmin` / `minioadmin`)가 뜬다.
local 프로파일 기본값이 이 값에 맞춰져 있어 별도 설정이 필요 없다.

MinIO는 auth-service의 프로필 이미지 업로드에 쓰인다. 버킷(`hondigagae-local`)은
`StorageBucketInitializer`가 기동 시 없으면 만든다.

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
- **Gradle 데몬 크래시** — `gradle.properties` 에서 힙을 `-Xmx2g` 로 올려 두었다(이 파일을 지우지 말 것).
  그래도 JDK 21.0.4 에서 `EXCEPTION_ACCESS_VIOLATION` 으로 데몬이 죽는 경우가 간헐적으로 있다.
  `./gradlew --stop` 후 다시 실행하면 통과한다.
- **소셜 로그인/메일 발송이 로컬에서 실패** — `OAUTH_*`, `MAIL_*` 자격증명이 없으면 기동은 되고
  해당 기능 호출 시점에만 실패하도록 되어 있다. 필요할 때 환경변수로 넣는다 (`.env.example` 참고).

## 새로 붙은 외부 연동 환경변수

날씨와 LLM 은 키가 없어도 **기동은 된다.** 로컬에서 서비스를 띄우는 데 키가 필요하지 않게
설계했다 — 없으면 각각 503 응답과 스텁 어댑터로 떨어진다.

### tour-service — 기상청 단기예보

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `KMA_API_SERVICE_KEY` | (비어 있음) | 공공데이터포털 **디코딩(원문)** 키. 인코딩은 어댑터가 한다 |
| `KMA_PUBLISH_DELAY_MINUTES` | `10` | 발표시각 이후 데이터가 올라오기까지의 여유(분) |
| `KMA_STALE_CACHE_SECONDS` | `21600` | 원천 실패 시 허용할 스테일 캐시 수명(6시간) |

관광공사(B551011) 키와 **같은 키를 쓸 수 있음이 실호출로 확인**되어 있다.
키가 비면 적합도/위험도 API 가 `INSIGHT_004`(503)로 응답하고 나머지 조회는 정상 동작한다.

Redis 가 떠 있어야 캐시가 동작한다. 없어도 기능은 돌지만 매 요청이 원천 호출이 되어
일 1,000건 제한을 금방 태운다 — 로컬에서 반복 테스트할 때 특히 주의.

### ai-service — LLM

LLM 어댑터(`OllamaLlmAdapter`, Spring AI)는 **항상 뜬다.** on/off 스위치와 스텁은 없다.
Ollama 가 없어도 기동은 되지만(연결은 첫 호출 때) 일정 생성 요청은 `AI_LLM_TIMEOUT_MS` 뒤 실패한다.

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AI_LLM_BASE_URL` | `http://localhost:11434` | 로컬 Ollama. 공유 인프라 ollama-01 을 쓰려면 그 사설 IP |
| `AI_LLM_MODEL` | `qwen2.5:7b-instruct` | 8GB 안에 들어가는 로컬 기본. dev 는 `gpt-oss:20b` |
| `AI_LLM_TIMEOUT_MS` | `120000` | 모델 호출 read timeout |
| `AI_LLM_PLACE_CANDIDATE_SIZE` | `50` | 프롬프트에 싣는 후보 장소 수 |
| `AI_LLM_CONTEXT_TOKENS` | `16384` | 컨텍스트 창(num_ctx). **비우면 Ollama 가 2048 로 잡아 프롬프트가 잘린다** — 줄이려면 후보 수도 함께 줄인다 |

일정 생성을 실제로 돌리려면 tour-service 도 함께 떠 있어야 한다 — 후보 장소를
tour-service 에서 받아 오기 때문이다. 프론트 개발자는 이 조합을 로컬에 띄우지 않고
dev 서버(`BACKEND_API_URL=https://api-dev.hondigagae.com`)에 직접 붙는다.

### 실행 순서 (배치)

```
placeImportJob → cultureFacilityImportJob → petRestaurantImportJob → placeMergeJob → placeImageBackfillJob → congestionImportJob
```

`placeMergeJob` 은 **적재가 모두 끝난 뒤 한 번** 돌린다 — 중복 판정에 세 원천이 다 들어와 있어야
하기 때문이다(#363). 적재 잡을 하나만 돌렸을 때도 이 잡을 이어 돌려야 중복이 목록에서 빠진다.

`congestionImportJob` 은 장소 마스터가 채워진 뒤에 돌려야 명칭 매칭이 붙는다.
비어 있으면 전부 UNMATCHED 로 적재되고 적합도 응답에서 혼잡도가 계속 빠진다.

`placeImageBackfillJob` 은 **문화정보원·식약처 적재 뒤**에 돌린다 — 그 두 원천에는 이미지
필드가 없어서 같은 장소가 TourAPI 에 있으면 대표 이미지를 빌려 채운다. 순서를 앞당기면
채울 대상이 아직 없어 0건으로 끝난다. 재실행은 멱등이다(이미 채워진 행은 대상에서 빠진다).

```bash
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=placeImageBackfillJob areaCode=39 runAt=$(date +%s)"
```

이 잡을 돌려도 **모든 장소에 사진이 생기지는 않는다.** 정규화 제목 일치 + 좌표 500m 를 둘 다
통과해야 채우기 때문이다(틀린 사진이 없는 사진보다 나쁘다). dev 실측(2026-09-08)에서
문화정보원 228곳 중 이름이 같은 TourAPI 행이 있는 곳은 2곳뿐이었고 둘 다 좌표가 1km 넘게
떨어져 있었다 — 나머지는 원천에 그 장소가 없다. 못 채운 자리는 프론트의 카테고리 일러스트가
담당한다.
