# 혼디가개 백엔드 배포 가이드

Dockerfile, compose 파일, Jenkinsfile 이 모두 저장소에 있다.
파이프라인 절차는 `jenkins-cicd-dev-deploy-guide.md`, 지표 수집은 `observability-guide.md` 참고.

## 배포 모델

BossPickSeoul 과 같은 공유 인프라(`D:\ProjectWorkSpace\Infra`)를 쓴다.

```text
GitHub (develop / main)
-> Jenkins controller
-> builder agent      (gradle test + bootJar)
-> deploy agent       (Vault secret → .env.runtime → docker compose up --build)
-> 컨테이너 상태 확인
```

deploy agent 가 Vault KV secret 전체를 읽어 `.env.runtime` 으로 변환하고
`docker compose --env-file` 에 넘긴다. 애플리케이션은 `.env` 파일을 직접 읽지 않는다.
이미지 빌드는 배포 호스트에서 일어나고, Dockerfile 은 builder 가 만든 `app.jar` 만 복사한다.

## 명명 규칙

| 항목 | 규칙 | 예 |
| --- | --- | --- |
| 이미지 | `hondigagae-{service}:latest` | `hondigagae-tour-service:latest` |
| 컨테이너 | `hondigagae-{service}-{env}` | `hondigagae-tour-service-dev` |
| Dockerfile | `{service}.Dockerfile` | `tour-service.Dockerfile` |
| Compose 파일 | `docker-compose-{service}.yml` | `docker-compose-tour-service.yml` |
| Vault 경로 | `kv/hondigagae/backend/{env}/env` | `kv/hondigagae/backend/dev/env` |
| 배포 경로 | `$HOME/deploy/hondigagae/backend/{group}/{service}` | `.../service/tour-service` |
| PR 라벨 | `backend-{service}` | `backend-tour-service` |
| compose 프로젝트 | 컨테이너명 prefix 와 동일 `hondigagae-{service}` (파이프라인이 `-p` 로 명시) | `hondigagae-tour-service` |

Vault 경로가 서비스별로 나뉘지 않는 점에 유의한다. **환경당 secret 하나**에 전 서비스의
env 키를 모아 두고, 각 compose 가 필요한 것만 골라 쓴다. 서비스마다 secret 을 쪼개면
`JWT_ACCESS_KEY` 처럼 여러 서비스가 같아야 하는 값을 여러 곳에서 관리하게 되고,
그 불일치가 곧 장애가 된다.

## 포트 대역

같은 호스트에서 BossPickSeoul 이 dev `6XXX` / prod `9XXX` 를 이미 점유하고 있다.
그대로 두면 둘 다 auth 가 6081 을 원해 포트 바인딩이 실패한다.
그래서 혼디가개는 **dev `7XXX` / prod `5XXX`** 를 쓴다. (Infra README §4 배치 원칙 5번)

| 서비스 | 컨테이너 내부 | dev (192.168.0.11) | prod (192.168.0.13) |
| --- | --- | --- | --- |
| service-discovery | 8761 | 7761 | 5761 |
| api-gateway | 8000 | 7000 | 5000 |
| batch-service | 8080 | 7080 | 5080 |
| auth-service | 8081 | 7081 | 5081 |
| tour-service | 8082 | 7082 | 5082 |
| plan-service | 8083 | 7083 | 5083 |
| ai-service | 8085 | 7085 | 5085 |
| frontend-web | 3000 | 7300 | 5300 |

컨테이너 안에서 앱이 듣는 포트는 dev/prod 가 같다. 호스트 포트만 다르다.
`.env.example` 의 `{SVC}_PORT` 가 내부, `{SVC}_PORT_DEV` / `{SVC}_PORT_PROD` 가 호스트 포트다.

compose 파일 하나에 dev/prod 서비스가 같이 정의되어 있고 `docker compose config` 가 양쪽을
모두 해석하므로, **dev secret 에도 `_PROD` 값을, prod secret 에도 `_DEV` 값을 넣는다.**

## 호스트 배치

| 환경 | 호스트 | 도메인 |
| --- | --- | --- |
| dev | `main-server` `192.168.0.11` | `api-dev.hondigagae.com` / `dev.hondigagae.com` |
| prod | `backend-1` `192.168.0.13` | `api.hondigagae.com` / `www.hondigagae.com` |

`storage`(`192.168.0.12`)에는 올리지 않는다. 총 1.9GB / swap 0 에 nginx 가 함께 있어
OOM 이 나면 전 도메인의 인그레스가 같이 죽는다.

**prod 호스트는 빠듯하다.** `backend-1` 은 available 6.4Gi 인데 tripmarble prod 5종과
BossPickSeoul prod 9종이 함께 올라간다. 혼디가개 7종을 더하면 여유가 거의 없다.
`{SVC}_MEM_LIMIT_PROD` 를 낮춰 잡거나, 운영 전에 호스트 증설을 검토한다.

## 서비스 간 통신

- **같은 호스트 안**(백엔드 7종끼리, Eureka 등록): `8llow8llowme-net` 브리지의 **컨테이너명**을 쓴다.
  그래서 `SERVICE_DISCOVERY_HOSTNAME` 은 사설 IP 가 아니라 `hondigagae-service-discovery-dev` 다.
- **다른 호스트로**(nginx → 백엔드, 백엔드 → MinIO): **사설 IP** 를 쓴다.
  `8llow8llowme-net` 은 호스트별 브리지라 다른 호스트의 컨테이너명이 해석되지 않는다.

## 환경 변수

`.env.example` 이 전체 목록의 단일 기준이다. Vault 에 넣을 때도 같은 key 이름을 쓴다.

키별로 넣는다. 파이프라인이 secret 의 `data.data` 를 키별 평면 맵으로 읽고 줄바꿈이 든 값은 거부하므로,
파일 전체를 `env_file` 한 키에 넣는 방식은 저장은 되지만 **배포 단계에서 실패한다.** Vault Web UI 의
JSON 토글에 `{"KEY": "value", ...}` 를 붙여 넣는 것이 가장 쉽고, CLI 는 `.env` 를 인자로 풀어 넘긴다.

```bash
# .env.example 을 .env 로 복사해 <...> 를 채운 뒤 (주석·빈 줄 제외)
docker exec -i vault vault kv put -mount="kv" hondigagae/backend/dev/env \
  $(grep -Ev '^\s*(#|$)' backend/.env | xargs)
```

키 목록과 환경별 값은 Infra 레포 `vault/README.md` 의 혼디가개 절에 표로 정리돼 있다.

배포 전 반드시 채워야 하는 것:

| key | 없으면 | 발급처 |
| --- | --- | --- |
| `TOUR_API_SERVICE_KEY` | 관광 데이터 적재 실패 | data.go.kr |
| `KMA_API_SERVICE_KEY` | 여행 적합도 조회 실패 (나머지 API 는 정상) | data.go.kr, 관광공사 키와 같은 키 사용 가능 |
| `VWORLD_API_KEY` | 식약처 음식점이 좌표 없이 적재 | vworld.kr (무료, 일 4만건) |
| `JWT_ACCESS_KEY` / `JWT_REFRESH_KEY` | 기동 실패 | 자체 생성 (HS512, 64바이트 이상) |
| `JASYPT_ENCRYPTOR_KEY` | 파이프라인 빌드 단계에서 중단 | 자체 생성 |
| `OAUTH_KAKAO_*` | 카카오 로그인 불가 | 카카오 개발자센터 |
| `BATCH_DATA_DIR` | compose 해석 실패로 배포 중단 | 배포 **호스트** 경로 (agent 컨테이너 안 경로가 아니다) |
| `DB_*`, `*_DB_URL`, `REDIS_*` | 기동 실패 | 인프라 — 아래 "DB 스키마 준비" 절 |
| `MINIO_*` | 프로필 이미지 업로드 실패 | storage(192.168.0.12) MinIO 에 `hondigagae` 버킷 생성 |

**주의**: Resource Server 계열(tour/plan/ai)은 `app.security.jwt.resource.access-key` 로 바인딩한다.
`jwt.access-key` 로 넣으면 컴파일도 기동도 되다가 **첫 인증 요청에서 jwtDecoder NPE** 로 죽는다.
실제로 겪은 함정이라 여기 적어 둔다.

Redis 는 dev 에서 BossPickSeoul dev 와 같은 `redis-node1`(192.168.0.11:6379) 에 **standalone** 으로
붙는다. `REDIS_MODE=sentinel` 은 compose 가 `REDIS_MASTER_NAME` / `REDIS_SENTINEL_NODES` 를
넘겨야 살고, 둘 중 하나가 비면 기동 시점에 어떤 env 를 넣어야 하는지 적힌 예외로 죽는다.

## DB 스키마 준비

MySQL 은 BossPickSeoul 과 같은 인스턴스(main-server `192.168.0.11:3306`)를 쓰고, 스키마와 계정만
혼디가개 것을 따로 만든다. **서비스마다 스키마 하나**, 스키마를 가로지르는 FK 는 두지 않는다 — 다른
서비스의 행은 ID 값으로만 참조하고 정합성은 애플리케이션이 책임진다(약한 결합). 스키마명은
BossPickSeoul 규칙 `{project}_{service}_{env}` 그대로다.

| 서비스 | 스키마 | env 키 | 비고 |
| --- | --- | --- | --- |
| auth-service | `hondigagae_auth_dev` | `AUTH_DB_URL` | 회원·반려견·토큰 |
| tour-service | `hondigagae_tour_dev` | `TOUR_DB_URL` | 장소·시설·날씨 캐시 |
| plan-service | `hondigagae_plan_dev` | `PLAN_DB_URL` | 일정·동행 반려견(plan_pet) |
| batch-service | `hondigagae_tour_dev` | `BATCH_DB_URL` | tour 와 같은 스키마. 적재 대상이 place 이고 BATCH_* 메타 테이블도 여기 생긴다 |
| ai-service · api-gateway · service-discovery | — | — | DB 없음 (Redis 만) |

dev 는 `ddl-auto: update` 라 테이블은 첫 기동 때 애플리케이션이 만든다. 사람이 미리 만드는 것은
스키마와 계정뿐이다. prod 는 `ddl-auto: none` 이므로 별도 마이그레이션 런북이 필요하다.

**스키마명은 Vault 의 `*_DB_URL` 과 한 글자도 다르면 안 된다.** 없으면 서비스가 기동 시
`Unknown database 'hondigagae_tour'` 로 죽는다 — JPA 는 테이블은 만들지만 데이터베이스는 만들지 않는다.
아래 SQL 은 `backend/scripts/mysql/init-dev-schemas.sql` 에 실행 가능한 형태로 있다.

```bash
docker exec -i mysql mysql -uroot -p < backend/scripts/mysql/init-dev-schemas.sql
```

```sql
-- main-server MySQL 에 root 로 접속해 1회 실행. 비밀번호는 Vault 의 DB_PASSWORD 와 같은 값.
CREATE DATABASE IF NOT EXISTS hondigagae_auth_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hondigagae_tour_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hondigagae_plan_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'hondigagae'@'%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON hondigagae_auth_dev.* TO 'hondigagae'@'%';
GRANT ALL PRIVILEGES ON hondigagae_tour_dev.* TO 'hondigagae'@'%';
GRANT ALL PRIVILEGES ON hondigagae_plan_dev.* TO 'hondigagae'@'%';
FLUSH PRIVILEGES;
```

계정을 `hondigagae_%.*` 와일드카드로 한 번에 주지 않는 이유는, prod 를 같은 인스턴스에 올리게
될 경우 dev 계정이 prod 스키마까지 보게 되기 때문이다. 스키마가 늘면 GRANT 도 한 줄 늘린다.

## 배포 순서

의존 방향을 따른다. 서비스마다 잡이 따로라 PR 라벨을 하나씩 붙여 순서대로 머지한다.

```
1. service-discovery      (다른 서비스가 등록할 대상)
2. api-gateway            (라우팅)
3. auth-service           (토큰 발급)
4. tour-service / plan-service / ai-service
5. batch-service          (웹 트래픽 없음, 마지막)
```

`batch-service` 는 기동 시 잡을 자동 실행하지 않는다(`spring.batch.job.enabled=false`).
단, **dev 는 프로세스 안 Quartz 스케줄이 정해진 시각에 파이프라인을 부른다**(#378 — 장소 월 03:00,
혼잡도 매일 06:00 KST). 기동 직후 적재가 필요하면 그 시각을 기다리지 말고 직접 부른다 —
`data-refresh-guide.md` 4절.

## 배포 후 점검

`{host}` 는 dev 면 `192.168.0.11`, prod 면 `192.168.0.13` 이다.

```bash
# 1. Eureka 등록 확인 (dev 7761 / prod 5761)
curl -s http://{host}:7761/eureka/apps | grep -o '<name>[^<]*</name>'

# 2. 각 서비스 health
curl -s http://{host}:7082/actuator/health

# 3. 게이트웨이 라우팅 (인증 불필요 경로)
curl -s "http://{host}:7000/api/v1/places?areaCode=39&size=1"

# 4. 공개 도메인 경유 (nginx + 인증서 확인)
curl -s "https://api-dev.hondigagae.com/api/v1/places?areaCode=39&size=1"

# 5. 적재 데이터 존재 확인
curl -s "http://{host}:7000/api/v1/emergencies/facilities?lat=33.4996&lng=126.5312&radius=5000"
```

5번이 0건이면 배치가 한 번도 안 돌았다는 뜻이다. 배포 실패가 아니라 데이터 미적재다.

## 트러블슈팅

| 증상 | 원인 | 조치 |
| --- | --- | --- |
| 포트 바인딩 실패 (`address already in use`) | BossPickSeoul 대역과 충돌 | `_PORT_DEV` 가 7xxx, `_PORT_PROD` 가 5xxx 인지 확인 |
| 기동 직후 jwtDecoder NPE | Resource Server 키 prefix 오타 | `app.security.jwt.resource.access-key` 확인 |
| Eureka 에 안 뜸 | `SERVICE_DISCOVERY_HOSTNAME` 이 사설 IP | discovery **컨테이너명**으로 지정 |
| 게이트웨이 503 | 대상 서비스 미기동 또는 Eureka 등록 전 | Eureka 앱 목록 먼저 확인 |
| 게이트웨이가 엉뚱한 서비스로 보냄 | `*_APP_NAME` 이 등록명과 불일치 | Eureka UI 의 등록명과 대조 |
| 배포 단계에서 `.env.runtime` key missing | Vault secret 에 키 누락 | `.env.example` 과 대조 |
| batch 컨테이너가 안 뜸 | `BATCH_DATA_DIR` 미설정 | 배포 호스트에 디렉터리를 만들고 Vault 에 경로 기입 |
| 기동 직후 `Unknown database 'hondigagae_…'` | Vault `*_DB_URL` 의 스키마가 MySQL 에 없음 (JPA 는 DB 를 만들지 않는다) | `backend/scripts/mysql/init-dev-schemas.sql` 실행. 스키마명과 URL 을 한 글자까지 맞춘다 |
| 장소 조회 0건 | 배치 미실행 | `data-refresh-guide.md` 4절 |
| Gradle 데몬 죽음 (`EXCEPTION_ACCESS_VIOLATION`) | 데몬 힙 부족 | `gradle.properties` 의 `-Xmx2g` 유지, `./gradlew --stop` 후 재시도 |
| 배포하면 BossPickSeoul 컨테이너가 사라짐 (또는 반대) | compose 프로젝트명이 디렉터리 basename(`api-gateway` 등)으로 두 프로젝트가 같아져 `--remove-orphans` 가 상대를 지움 | 파이프라인이 `-p {containerNamePrefix}` 를 명시한다. **두 레포 모두** 반영돼야 하고, 처음 한 번은 옛 프로젝트 컨테이너를 자동으로 정리한다 |
