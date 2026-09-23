# Jenkins CI/CD 배포 설정 가이드

공유 인프라(`D:\ProjectWorkSpace\Infra`)에 Jenkins·Vault·nginx·Prometheus 가 이미 서 있고,
혼디가개는 그 위에 파이프라인만 얹는다. 명명·포트 규약은 `deploy-guide.md` 를 따른다.

파이프라인은 BossPickSeoul(NowDoBoss-V2)에서 이식했다. 게이트 규칙이 같으므로,
동작이 헷갈리면 그쪽 잡의 빌드 로그를 참고해도 된다.

## 1. 전체 배포 흐름

```text
PR 생성 / 갱신
  → 멀티브랜치 PR 잡: CI 만 수행 (gradle test + bootJar). 배포하지 않는다.
develop / main 에 머지
  → 브랜치 잡: PR 라벨을 조회해 배포 대상만 골라낸다
  → builder agent (builder-backend)
       ./gradlew :{group}:{svc}:test :{group}:{svc}:bootJar
       stash: jar + Dockerfile + compose
  → deploy agent (deploy-backend-dev | deploy-backend-prod)
       Vault kv/hondigagae/backend/{env}/env 조회 → .env.runtime 생성
       rsync → app.jar 배치 → docker compose up -d --build
  → 컨테이너 running 확인 (최대 150초)
```

`develop → dev`, `main → prod` 다. 그 외 브랜치는 배포하지 않는다.

## 2. 배포는 PR 라벨로 지정한다 (fail-closed)

모노레포라 push 한 번에 잡 8개(백엔드 7 + 프론트 1)가 전부 트리거된다.
어떤 잡이 실제로 배포할지는 **PR 라벨**이 정한다.

| 라벨 | 배포 대상 |
| --- | --- |
| `backend-service-discovery` | service-discovery |
| `backend-api-gateway` | api-gateway |
| `backend-auth-service` | auth-service |
| `backend-tour-service` | tour-service |
| `backend-plan-service` | plan-service |
| `backend-ai-service` | ai-service |
| `backend-batch-service` | batch-service |
| `frontend-web` | 프론트 웹 |

**라벨이 하나도 없으면 아무것도 배포하지 않는다.** 배포는 의도적으로 지정한 대상만 나가야 하므로
"라벨 없음 = 전체 배포"로 넓히지 않는다. 라벨을 빠뜨리고 머지했다면 해당 잡을
`FORCE_DEPLOY=true` 로 수동 실행한다.

라벨 조회에는 GitHub App credential 이 필요하다. 조회에 실패하면 배포를 막고 빌드를
**UNSTABLE** 로 표시한다 — credential 오설정으로 배포가 조용히 멈추는 것을 알아채기 위해서다.

## 3. 빌드 범위 — 변경된 모듈만 돈다

각 잡은 이번 변경이 자기와 관계있는지 먼저 판단한다.

| 변경 경로 | 판정 |
| --- | --- |
| `backend/{group}/{svc}/**` | 그 서비스만 `own` |
| `backend/core/**`, `backend/build.gradle`, `backend/settings.gradle`, `backend/gradle**` | 전 서비스 `own` |
| `Jenkinsfile.backend-common.groovy`, `Jenkinsfile-{svc}` | `pipeline` |
| 그 외 (`backend/docs/**`, `frontend/**` 등) | `none` — 건너뜀 |

`core/**` 변경이 전 서비스를 돌리는 점이 중요하다. `common-core` 의 `GeoDistance` 나
`shared-travel` 의 enum 처럼 여러 서비스가 함께 쓰는 코드가 있어, core 변경이 다른 서비스의
컴파일을 깨는지는 PR 단계에서 잡아야 한다.

판단이 불가능하면(첫 빌드 등) 전체 빌드로 진행한다(fail-open).

## 4. Jenkins node 와 label

BossPickSeoul 과 **같은 agent** 를 쓴다. 새로 띄울 것은 없다.

| 역할 | label | 호스트 | 하는 일 |
| --- | --- | --- | --- |
| builder (backend) | `builder-backend` | ollama-01 `192.168.0.10` | Gradle 빌드 |
| builder (frontend) | `builder-frontend` | ollama-01 `192.168.0.10` | pnpm 빌드 |
| deploy (dev) | `deploy-backend-dev` | main-server `192.168.0.11` | Vault 조회, compose up |
| deploy (prod) | `deploy-backend-prod` | backend-1 `192.168.0.13` | 동일 |
| deploy (fe dev) | `deploy-frontend-dev` | main-server `192.168.0.11` | 번들 전개, compose up |
| deploy (fe prod) | `deploy-frontend-prod` | backend-1 `192.168.0.13` | 동일 |

agent 에 필요한 도구: `java 21`, `docker`, `docker compose`, `rsync`, `curl`.
(Vault CLI 는 필요 없다. 파이프라인이 HTTP API 를 직접 부른다)

**dev 는 준비됐고 prod 는 아니다.** main-server `docker ps` (2026-09-03) 기준 현황:

| agent | 상태 |
| --- | --- |
| `ai-host-builder` | 기동 중. `builder-frontend` 라벨이 붙어 있는지 Jenkins 노드 화면에서 확인 |
| `backend-dev-agent` | 기동 중 (main-server, `deploy-backend-dev`) |
| `frontend-dev-agent` | 기동 중 (main-server, `deploy-frontend-dev`) |
| `backend-prod-agent` | **미기동** — backend-1(운영 미니 PC) 에 컨테이너 추가 필요 |
| `frontend-prod-agent` | **미기동** — backend-1 에 컨테이너 추가 필요 |

agent 가 없으면 해당 잡은 실행 자체를 못 하고 노드를 기다리며 멈춘다(빌드 실패가 아니라 대기다).
`Infra/jenkins/docker-compose-jenkins-deploy-agent.yml` 로 띄우고 위 라벨을 붙인다.
즉, **dev 는 백엔드·프론트 모두 지금 배포 가능하고** prod 둘은 agent 를 먼저 띄워야 한다.

BossPickSeoul 잡과 agent 를 공유하므로 `hondigagae-*` 잡을 새로 만들 때 노드 라벨은 그대로 두고
credential(`hondigagae-vault-role-id` / `-secret-id`)만 프로젝트 것으로 바꾼다.

deploy agent 의 `$HOME` 은 컨테이너 안의 `/home/jenkins` 다. 배포 디렉터리
`$HOME/deploy/hondigagae/...` 는 그 안에 생기지만, compose 의 **바인드 마운트**(`BATCH_DATA_DIR`)는
`/var/run/docker.sock` 을 통해 호스트 데몬이 해석하므로 **호스트 경로**를 적어야 한다.

> **아키텍처 주의** — 빌더가 도는 ollama-01 은 x86_64 이고 배포 대상은 모두 aarch64 다.
> 백엔드는 JAR 이라 무관하지만 프론트는 빌더에서 만든 `.next/standalone` 을 arm64 에서 실행한다.
>
> 프론트는 실제로 이 문제에 걸린다. `next/image` 최적화용 `sharp` 가 플랫폼별 네이티브
> 바이너리라, 아무 설정 없이 빌드하면 번들에 `@img/sharp-*-x64` 가 들어간다(로컬 확인함).
> `frontend/next.config.ts` 의 `images.unoptimized` + `outputFileTracingExcludes` 가 이를 막는다.
> 그 설정을 지우면 번들에 `*.node` 가 다시 섞이고, 파이프라인이 빌드를 UNSTABLE 로 표시해 알려준다.

배포는 `hondigagae-backend-deploy` / `hondigagae-frontend-deploy` Lockable Resource 로
직렬화한다. BossPickSeoul 과 lock 을 공유하지 않아 서로의 배포를 막지 않는다.

## 5. Vault secret 구조

환경당 secret 하나다. 서비스별로 쪼개지 않는다.

```text
kv/hondigagae/backend/dev/env
kv/hondigagae/backend/prod/env
kv/hondigagae/frontend/dev/env
kv/hondigagae/frontend/prod/env
```

파이프라인은 `{root}/{env}/env` 규칙으로 경로를 조립한다. root 기본값은 backend 잡이
`kv/hondigagae/backend`, frontend 잡이 `kv/hondigagae/frontend` 다.
잡 파라미터 `VAULT_SECRET_ROOT` / `VAULT_SECRET_PATH` 로 덮어쓸 수 있지만 평소에는 건드리지 않는다.

key 이름은 `backend/.env.example` / `frontend/.env.example` 과 **정확히 같게** 둔다.
두 곳의 이름이 갈리면 `.env.runtime` 생성 시 매핑 코드가 필요해지고, 그 매핑이 곧 장애 원인이 된다.

정책과 AppRole 은 Infra 레포에 있다.

- `Infra/vault/policies/jenkins-hondigagae.hcl` — backend + frontend 공용 읽기 권한
- `Infra/vault/policies/backend-hondigagae.hcl` — deploy/runtime 용
- `Infra/vault/policies/ui-hondigagae.hcl` — Web UI 관리용
- `Infra/vault/scripts/bootstrap-hondigagae.sh` — 정책·AppRole 등록

AppRole 은 파이프라인별로 나누지 않는다. backend 잡과 frontend 잡이 같은
`jenkins-hondigagae` role 하나를 쓴다. 애플리케이션 그룹이 늘면 credential 을 추가하는 게 아니라
`jenkins-hondigagae.hcl` 에 경로 블록을 더하고 bootstrap 을 다시 돌린다.

### Jenkins credential

| Credential ID | 종류 | 값 |
| --- | --- | --- |
| `hondigagae-vault-role-id` | Secret text | `vault read auth/approle/role/jenkins-hondigagae/role-id` |
| `hondigagae-vault-secret-id` | Secret text | `vault write -f auth/approle/role/jenkins-hondigagae/secret-id` |
| `github-app-followfollowme-jenkins` | GitHub App | BossPickSeoul 과 공용. hondigagae 레포에 App 설치가 되어 있어야 한다 |

## 6. 파이프라인 파라미터

기본값으로 두면 웹훅 빌드가 정상 동작한다. 수동 실행할 때만 만진다.

| 파라미터 | 기본값 | 용도 |
| --- | --- | --- |
| `RUN_TESTS` | `true` | bootJar 전에 대상 모듈 테스트 실행 |
| `SKIP_DEPLOY` | `false` | 배포 없이 빌드만 |
| `FORCE_DEPLOY` | `false` | 변경 감지·라벨 게이트 우회. 라벨 빠뜨린 머지 커밋 수동 배포용 |
| `PROJECT_SLUG` | `hondigagae` | Vault 경로와 배포 디렉터리 식별자 |
| `VAULT_ADDR` | `https://vault.8llow8llowme.com` | Vault API 주소 |
| `DEPLOY_LOCK_NAME` | `hondigagae-backend-deploy` | 배포 직렬화용 Lockable Resource |

`RUN_TESTS=false` 를 기본값으로 두지 않는다. 이 저장소의 테스트는 H2 로 JPQL 과 스키마를
검증하는데, 그게 없으면 **기동 시점에야** 쿼리 오류가 드러난다.
실제로 `@Comment` 안 작은따옴표가 DDL 을 깨뜨린 건을 그 테스트가 잡았다.

`FORCE_DEPLOY` 는 브랜치 규칙(PR 빌드 배포 금지, dev/prod 브랜치 한정)과 `SKIP_DEPLOY` 는
그대로 적용한다. 우회하는 것은 변경 감지와 라벨 게이트 둘뿐이다.

## 7. 프론트 파이프라인

백엔드와 게이트 규칙(PR 라벨, 변경 감지, FORCE_DEPLOY)은 같고, Next.js 특성에서 오는 차이만 있다.

### 단계

```text
pnpm install --frozen-lockfile
pnpm format:check / lint / typecheck / test      (RUN_TESTS=true 일 때)
pnpm build                                        → .next/standalone/server.js 확인
번들 tar (standalone + static + public + Dockerfile + compose)
  → 배포 에이전트에서 전개 → compose up → 컨테이너 running → SSR HTTP 응답 확인
```

산출물을 tar 로 묶는 이유는 standalone 이 작은 파일 수천 개라 그대로 stash 하면 매우 느리기 때문이다.
백엔드가 `app.jar` 하나만 넘기는 것과 같은 이유다.

배포 시 `SERVICE_DIR` 을 통째로 지우고 다시 전개한다. 이전 배포의 정적 파일이 남으면
삭제된 파일이 계속 서빙된다.

### `output: 'standalone'` 이 전제다

`frontend/next.config.ts` 의 `output: 'standalone'` 이 없으면 `.next/standalone/server.js` 가
생기지 않고 파이프라인이 빌드 후 검사에서 막는다. 컨테이너는 이 산출물만 복사하고
안에서 `pnpm install` / `next build` 를 돌리지 않는다 — 배포 대상이 라즈베리파이(aarch64)라
이미지 빌드에 몇 분씩 쓸 수 없기 때문이다.

### 프론트 키 이름은 BossPickSeoul 과 같다

`kv/hondigagae/frontend/{env}/env` 의 키는 `kv/bosspickseoul/frontend/{env}/env` 와 이름이 같다
(`AUTH_SESSION_SECRET`, `BACKEND_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`,
`TIME_ZONE`, `FRONTEND_WEB_PORT`, `FRONTEND_WEB_MEM_LIMIT`). 두 프로젝트의 Vault 를 나란히 관리하므로
이름을 갈라 두지 않는다. 차이는 `NEXT_PUBLIC_WS_URL` 을 요구하지 않는 것 하나다 (WebSocket 미사용).
백엔드 키도 공통 인프라 항목(`DB_*`, `REDIS_*`, `JWT_*`, `MINIO_*`, `MAIL_*`, `AI_LLM_*`)은 이름이 같고,
서비스 고유 키(`TOUR_*`, `KMA_*`, `PLAN_*`)만 다르다.

### 빌드 시점에 필요한 값이 넷이다

`NEXT_PUBLIC_*` 는 빌드 시점에 코드로 인라인되므로 dev 와 prod 는 같은 커밋이라도 각각 빌드한다.
그런데 `NEXT_PUBLIC_` 이 아닌 값 둘도 빌드에 필요하다.

| key | 빌드에 필요한 이유 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 번들에 인라인. og:image 절대 URL 의 기준. 비면 localhost 번들이 배포된다 |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | 번들에 인라인. `src/lib/env.client.ts` 가 zod `min(1)` 로 검증 |
| `BACKEND_API_URL` | `src/lib/env.server.ts` 가 모듈 로드 시점에 zod `url()` 로 fail-fast |
| `AUTH_SESSION_SECRET` | 〃 `min(32)` |

`.github/workflows/frontend-ci.yml` 이 `pnpm build` 에 placeholder 를 넘기는 것도 같은 이유다.
파이프라인은 Vault secret 전체를 빌드 단계에 주입하므로 따로 신경 쓸 것은 없다.

### `AUTH_SESSION_SECRET` 은 환경당 한 번만 만든다

세션 쿠키의 암호화 키다. 배포마다 새로 만들면 기존 쿠키를 복호화할 수 없어
**로그인한 사용자가 전원 로그아웃**된다. 유출됐을 때만 의도적으로 교체하고,
그때도 전원 로그아웃을 감수하는 작업으로 다룬다. dev 와 prod 는 서로 다른 값을 쓴다.

### GitHub Actions 와 역할이 겹치지 않나

`.github/workflows/frontend-ci.yml` 이 같은 검사를 돈다. 역할이 다르다 —
Actions 는 모든 PR 의 빠른 게이트이고, 이 잡은 **배포까지 가는 경로**를 같은 검사로 한 번 더 확인한다.
Jenkins 쪽만 Vault 실값으로 빌드하므로, 키가 빠져 깨지는 번들은 여기서만 걸린다.

## 8. 배치 잡은 배포 파이프라인에 넣지 않는다

batch-service 는 **배포와 적재를 분리**한다. 컨테이너를 띄우는 것과 잡을 도는 것은 다른 일이고,
적재는 몇 분씩 걸리며 외부 API 상태에 좌우된다. 배포 파이프라인이 그것을 기다리면
배포 성공/실패 신호가 흐려진다.

**주기 실행은 프로세스 안 Quartz 가 맡는다** (#378) — 장소 파이프라인 월 03:00 KST,
올레 월 05:00 KST, 혼잡도 매일 06:00 KST, dev 만 켜져 있다. 자세한 내용은 `data-refresh-guide.md` 4절.
배포 파이프라인에 넣지 않는다는 원칙은 그대로다. 바뀐 것은 "사람이 언젠가 손으로 부른다"가
"컨테이너가 정해진 시각에 스스로 부른다"가 된 것뿐이다.

적재를 지금 당장 한 번 돌려야 하면(첫 배포 직후, 원천 복구 뒤 따라잡기) 아래처럼 부른다.
잡별 파라미터·백그라운드 실행·결과 확인까지 이어진 절차는 `batch-dev-runbook.md` 에 있다.

```bash
docker exec hondigagae-batch-service-dev \
  java -XX:MaxRAMPercentage=25 -XX:InitialRAMPercentage=5 -jar /app/batch-service.jar \
    --spring.main.web-application-type=none \
    --eureka.client.enabled=false \
    --spring.batch.job.enabled=true \
    --spring.batch.job.name=placeDataPipelineJob \
    areaCode=39 runAt=2026-09-14T03:00:00
```

플래그가 늘어난 이유가 각각 있다. **이 명령은 이미 떠 있는 컨테이너 안에 두 번째 JVM 을 띄운다.**

| 플래그 | 없으면 |
| --- | --- |
| `-XX:MaxRAMPercentage=25` | 두 JVM 이 같은 컨테이너 메모리 상한(dev 512m)을 각자 70% 로 잡아 OOM 으로 상시 컨테이너까지 죽는다 |
| `--spring.main.web-application-type=none` | 두 번째 JVM 이 8080 에 다시 바인딩하려다 기동 실패한다 |
| `--eureka.client.enabled=false` | 같은 서비스가 Eureka 에 두 번 등록돼 게이트웨이가 곧 사라질 인스턴스로 라우팅한다 |
| `--spring.batch.job.enabled=true` | 잡이 돌지 않는다. 동시에 이 값이 **스케줄러를 끄는 조건**이라 수동 JVM 은 트리거를 등록하지 않고 스케줄러도 시작되지 않는다 (`auto-startup` 은 조건이 참일 때만 커스터마이저가 켠다) |
| `runAt=<ISO 시각>` | 같은 JobInstance 로 판정돼 재시작 금지(`JobRestartException`) 로 거부된다. 앞선 실행이 COMPLETED 였다면 `JobInstanceAlreadyCompleteException` 이다 |

스케줄 창(03:00·06:00)과 겹쳐도 데이터가 깨지지는 않는다 — **스케줄 쪽이 배치 메타데이터를 보고
양보한다**(`schedule fire skipped ...` WARN). 반대 방향은 막히지 않으니, 수동 실행은 스케줄 창을
피하는 편이 낫다.

## 9. 첫 배포 순서

1. **Vault bootstrap** — `docker exec -it vault sh /vault/scripts/bootstrap-hondigagae.sh`
2. **AppRole 발급** — `rotate-approle-secret.sh jenkins-hondigagae` → Jenkins credential 2개 등록
3. **Vault secret 적재** — `kv/hondigagae/backend/dev/env` 에 `backend/.env.example` 채운 값
4. **nginx conf 적용** — Infra 레포의 `nginx/conf.d/*.hondigagae.conf` 4개.
   HTTPS 블록은 주석 상태로 두고 reload → 인증서 발급 → 주석 해제 후 다시 reload
5. **배포 호스트 준비** — deploy agent 와 batch CSV 디렉터리를 **dev(main-server) · prod(`backend-1`) 둘 다** 만들고,
   그 호스트 경로를 각 환경 Vault 의 `BATCH_DATA_DIR` 에 넣는다. dev 를 빠뜨리면 batch 만 배포되지 않는다 (#878)
6. **멀티브랜치 파이프라인 8개 생성** — 잡 이름은 `hondigagae-{service}` / `hondigagae-frontend-web`
7. **`service-discovery` 배포** → Eureka UI 확인
8. **`api-gateway` 배포** → 라우팅 확인
9. **나머지 서비스 배포**
10. **배치 1회 수동 실행** → 장소 데이터 적재
11. **Prometheus target 등록** (`observability-guide.md`)

10번을 빠뜨리면 모든 API 가 정상 응답하면서 결과만 0건이다. 배포 실패로 오인하기 쉽다.

## 10. 자주 걸릴 지점

| 증상 | 원인 |
| --- | --- |
| 잡이 '변경 없음 - 생략' 으로 끝남 | 이번 push 가 그 서비스와 무관. 정상 동작이다 |
| 잡이 '배포 대상 라벨 미지정' 으로 끝남 | PR 에 `backend-{svc}` 라벨을 안 붙였다 |
| 빌드가 UNSTABLE, 배포 생략 | GitHub App credential 문제로 라벨 조회 실패 |
| 빌드는 되는데 기동 실패 | Vault key 이름이 `.env.example` 과 다름 |
| 인증 요청에서만 죽음 | Resource Server 는 `app.security.jwt.resource.access-key` 로 바인딩 |
| Eureka 미등록 | `SERVICE_DISCOVERY_HOSTNAME` 이 사설 IP — 컨테이너명이어야 함 |
| 포트 바인딩 실패 | BossPickSeoul 6xxx/9xxx 와 충돌. 7xxx/5xxx 확인 |
| Gradle 데몬 죽음 | `gradle.properties` 의 `-Xmx2g` 가 agent 에 반영됐는지 확인 |
| 배치만 실패 | `VWORLD_API_KEY` / `TOUR_API_SERVICE_KEY` / `BATCH_DATA_DIR` 누락 |
| 배포 로그에 `BATCH_DATA_DIR is empty` | Vault 에 `BATCH_DATA_DIR` 이 없거나 비었다. compose 가 `:?` 로 여기서 멈춘다 (#878) |
| `컨테이너가 기동 직후 안정되지 않았습니다` | 컨테이너가 떴다가 45초 안에 죽었거나 재시작했다. 뒤따르는 `docker logs` 에 원인이 있다. 전에는 첫 `running` 만 보고 초록으로 끝나 재시작 루프가 숨었다 (#878) |
| 배포는 끝났는데 스케줄 적재가 없다 | 아래 쿼리가 0 이면 스케줄이 한 번도 돌지 않은 것이다. `docker ps -a --filter name=hondigagae-batch-service` 부터 본다 (#878) |
| API 는 새 필드를 내려주는데 값이 전부 기본값(null/false) | 배치가 채우는 컬럼이다. 배포 뒤 해당 적재 잡을 다시 돌리지 않았다 (§8, #301) |

스케줄 발화 확인 (tour 스키마):

```sql
-- 스케줄 창(03·05·06시)에 시작한 실행 수. 수동 실행만 있었다면 0 이다
SELECT COUNT(*) FROM BATCH_JOB_EXECUTION WHERE HOUR(START_TIME) IN (3, 5, 6);
```

## 11. 보안 체크리스트

- [ ] `.env` 가 저장소에 없다 (`.gitignore` 의 `.env`, `.env.*`, `!.env.example`)
- [ ] 실제 키가 `.env.example` 에 들어가지 않았다
- [ ] Vault AppRole `secret_id` 를 이슈·PR·메신저에 남기지 않았다
- [ ] `jenkins-hondigagae` 정책이 `kv/hondigagae/*` 밖을 읽지 않는다
- [ ] 컨테이너 로그에 secret 이 찍히지 않는다 (properties 를 통째로 로깅하지 않기)
- [ ] actuator 는 `health`, `info`, `prometheus` 만 열려 있다
- [ ] `dev.hondigagae.com` / `api-dev.hondigagae.com` 에 `X-Robots-Tag: noindex` 가 붙는다
