# 혼디가개 백엔드 Observability 가이드

> 공통 설정은 **이미 적용돼 있다**. Prometheus target 등록과 대시보드는 배포 시점에 붙인다.
> 배포 규약은 `deploy-guide.md`, 배치 갱신 지표는 `data-refresh-guide.md` 6절 참고.

## 1차 목표

공모전 시연 기준으로 답할 수 있어야 하는 질문 넷이다.

1. 서비스가 살아 있나 (`up`, `/actuator/health`)
2. 어떤 API 가 느린가 (p95/p99)
3. 외부 API 가 우리를 막고 있나 (서킷 상태, 호출 실패율)
4. **장소 데이터가 얼마나 낡았나** (마지막 적재 성공 시각)

4번은 다른 프로젝트에 없는 항목이다. 이 서비스는 데이터 신선도가 곧 품질이라 지표로 본다.

## 이미 적용된 공통 설정

전 서비스가 root `build.gradle` 에서 아래를 상속한다.

```groovy
implementation 'org.springframework.boot:spring-boot-starter-actuator'
runtimeOnly 'io.micrometer:micrometer-registry-prometheus'
```

각 서비스 `application.yml` 이 공통 설정을 import 한다.

```yaml
spring:
  config:
    import: optional:classpath:observability-common.yml
```

리소스는 두 곳에 있다.

- `core/common-core/src/main/resources/observability-common.yml` — 일반 서비스용
- `cloud/service-discovery/src/main/resources/observability-common.yml` — 같은 내용.
  service-discovery 가 `common-core` 를 의존하지 않기 위해 자기 classpath 에 복사해 둔 것

`health`, `info`, `prometheus` 만 연다. 나머지 actuator endpoint 는 노출하지 않는다.

## Prometheus target 등록

공유 인프라의 `monitoring/prometheus/targets/` 에 파일을 추가한다.
BossPickSeoul 이 쓰는 `file_sd_configs` 규칙을 그대로 따르면 job 정의만 늘리면 된다.

```yaml
# monitoring/prometheus/prometheus.yml 에 추가
- job_name: hondigagae-cloud
  metrics_path: /actuator/prometheus
  file_sd_configs:
    - files:
        - /etc/prometheus/targets/hondigagae-cloud-*.yml

- job_name: hondigagae-service
  metrics_path: /actuator/prometheus
  file_sd_configs:
    - files:
        - /etc/prometheus/targets/hondigagae-service-*.yml
```

target 파일의 라벨 계약도 동일하게 맞춘다. 대시보드를 프로젝트 라벨로 갈라 쓰기 위해서다.

```yaml
# monitoring/prometheus/targets/hondigagae-service-dev.yml
- targets:
    - "{host}:{port}"
  labels:
    project: hondigagae
    service_group: service
    env: dev
    host: main-server
    service: tour-service
    container: hondigagae-tour-service-dev
```

포트는 `deploy-guide.md` 의 대역 결정이 끝나야 채울 수 있다.

## 배치 지표 — 이 프로젝트의 핵심

일반 웹 지표만으로는 "데이터가 낡았다"를 잡지 못한다. 배치가 조용히 멈추면 에러율도
지연도 정상인 채로 데이터만 몇 주씩 묵는다.

노출하는 지표 둘.

```
place_import_rows{source, result}            # upserted / delisted / geocode_failed / fallback
place_import_last_success_timestamp{source}  # 소스별 마지막 성공 시각(epoch seconds)
```

`source` 는 `PlaceSourceType` 이름(`TOUR_API` / `CULTURE_PORTAL` / `MFDS`)이다.
`inserted/updated` 를 나누지 않는 이유: 적재가 JdbcTemplate upsert 라 구분해 세지 않고,
경보도 그 구분을 쓰지 않는다.

`fallback` 만 단위가 다르다 — 행 수가 아니라 **마지막 실행이 우회 원천을 썼는지**를 담는
1/0 플래그다 (#379, `CULTURE_PORTAL` 만 쓴다).

경보 기준.

| 조건 | 심각도 | 뜻 |
| --- | --- | --- |
| `time() - place_import_last_success_timestamp{source="MFDS"} > 14d` | 경고 | 주 1회 잡이 2주간 성공 못함 |
| `place_import_rows{result="geocode_failed"} > 10` | 경고 | VWorld 응답 이상 또는 주소 형식 변화 |
| `place_import_rows{result="delisted"} > 30` | **심각** | 원천 이상 의심. 급감 가드가 놓쳤을 수 있다 |
| `place_import_rows{source="CULTURE_PORTAL",result="fallback"} == 1` | 경고 | 포털 자동 다운로드가 실패해 우회 파일로 적재 중. 스크레이퍼·포털 확인 |

마지막 항목이 왜 필요한가. 우회 적재도 행이 들어오므로 `last_success` 가 갱신되고, 그러면
포털 스크레이핑이 몇 주째 끊겨 매주 같은 로컬 파일을 다시 넣고 있어도 신선도 경보가 침묵한다.
WARN 로그(`culture facility source fallback=local`) 하나로는 아무도 그 상태를 보지 않는다.

delisted 항목도 중요하다. delisting 은 잘못 돌면 데이터를 통째로 날리므로,
급감 가드(`data-refresh-guide.md` 2절)와 이 경보가 이중 방어선이다.

**구현 방식** (batch-service `placeimport` 도메인, `PlaceImportMetricsPort` +
`MicrometerPlaceImportMetricsAdapter`):

- `place_import_rows` 는 Counter 가 아니라 **마지막 실행 값을 담는 Gauge** 다.
  위 경보 기준이 실행 단위 값을 전제하기 때문이다. Counter 누적값은 `increase()` 없이
  실행 단위를 읽을 수 없다.
- `last_success` 는 **단조 증가**로만 갱신하고, **실제로 데이터가 들어온 실행(imported > 0)**
  만 성공으로 친다. 원천이 빈 응답을 준 실행을 성공으로 남기면 경보가 침묵한다.
- **예외 하나: 검증된 무변경 skip 도 `last_success` 를 갱신한다** (#379). 문화정보원처럼 원천
  파일이 몇 달에 한 번 바뀌는 소스는, 포털을 실제로 확인해 "지금 올라와 있는 것이 이미 적재한 그
  파일"임을 안 실행이 곧 성공이다. 적재 건수가 0 이라는 이유로 갱신하지 않으면 아무 문제 없는
  상태에서 14일 경보가 울리고, 그런 경보는 곧 무시당해 진짜 고장까지 함께 묻힌다.
  원천을 못 읽어 로컬 우회로 물러난 실행은 이 예외에 들지 않는다 — 그때는 실제로 적재된
  건수만 성공으로 친다.
- **우회 여부는 `result="fallback"` 게이지로 따로 드러낸다** (#379). 우회 적재도 행이 들어와
  `last_success` 를 갱신하므로, 그 게이지가 없으면 포털이 끊긴 상태가 신선도 경보에 잡히지
  않는다. 파사드가 **모든 실행 경로에서** 1/0 을 쓴다 — 건너뛴 실행과 정상 적재는 0 이라,
  우회 뒤 정상 실행이 오면 값이 0 으로 되돌아간다.
- 게이지는 프로세스 메모리에만 있으므로, 기동 시 `PlaceImportMetricsSeeder` 가
  Spring Batch 메타데이터에서 잡별 마지막 COMPLETED 실행 종료 시각을 **씨딩**한다.
  배포 직후에도 신선도 패널이 비지 않는다. `place_import_rows` 는 씨딩하지 않아
  재기동 후 첫 실행 전까지는 값이 없다 — 없는 것이 0 으로 보이는 것보다 낫다.
- 긴급 시설·이미지 잡·혼잡도 잡은 이 지표에 넣지 않는다. `place_import_rows` 는
  장소 마스터 기준이고, 긴급 시설은 급감 가드 + 경고 로그가 별도로 지킨다.

### 스케줄 발화 지표 (#378)

위 두 지표는 "잡이 성공했나"에 답한다. 그 앞 질문 — **"스케줄러가 살아서 발화는 하고 있나"** —
은 따로 봐야 한다. 컨테이너가 죽었거나 스위치가 꺼진 채 배포됐으면 실패 로그조차 남지 않는다.

```
batch_schedule_fire_total{job, result}       # launched / skipped_running / failed
batch_schedule_last_fire_timestamp{job}      # 잡별 마지막 발화 시각(epoch seconds)
```

`last_fire` 는 **결과와 무관하게** 발화 시각을 기록한다. 건너뛴 발화도 스케줄러가 살아 있다는
증거이기 때문이다. 발화 횟수는 Gauge 가 아니라 Counter 다 — 여기서 보는 것은 "마지막 실행에서
몇 건"이 아니라 "지난 한 주에 몇 번 건너뛰었나"라 누적값이 맞다.

경보 기준.

| 조건 | 심각도 | 뜻 |
| --- | --- | --- |
| `time() - batch_schedule_last_fire_timestamp{job="placeDataPipelineJob"} > 8d` | 경고 | 주 1회 스케줄이 한 주기를 통째로 놓쳤다 |
| `time() - batch_schedule_last_fire_timestamp{job="congestionImportJob"} > 2d` | 경고 | 일 1회 스케줄이 멈췄다 |
| `increase(batch_schedule_fire_total{result="skipped_running"}[14d]) >= 2` | 경고 | 앞 실행이 계속 안 끝난다. 잡 자체가 오래 걸리거나 STARTED 행이 방치됐다 |

첫 항목의 8일은 주기(7일)에 하루를 더한 값이다. `place_import_last_success_timestamp` 경보(14일)
보다 먼저 울려야 한다 — 발화가 멈춘 것과 발화는 했는데 잡이 실패한 것은 대응이 다르다.

**구현 방식**: batch-service `schedule` 도메인, `ScheduleMetricsPort` +
`MicrometerScheduleMetricsAdapter`. 스케줄이 꺼진 환경(local·CI·prod 기본)에서는 발화가 없어
지표도 나오지 않는다.

## 외부 API 지표

Resilience4j 가 자동으로 노출한다.

```
resilience4j_circuitbreaker_state{name}
resilience4j_circuitbreaker_calls_seconds_count{name, kind="successful|failed"}
```

batch-service 는 제공처 단위로 인스턴스를 나눠 다섯 개를 쓴다 — `tourapi` / `tats` / `vworld` /
`mfds` / `datagokr` (`application.yml` 의 `resilience4j.circuitbreaker.instances`). 배치라 사용자
요청을 막지는 않지만, 원천이 죽었을 때 수천 건을 타임아웃까지 두드리며 쿼터만 태우는 것을 막는다.
`vworld` 는 호출량이 가장 많아 창을 넓게(50/20), `mfds` 와 `datagokr` 은 잡당 한두 번뿐이라
좁게(5/3) 잡았다. `datagokr`(공공데이터포털 파일 서버, #379)만 느린 호출 기준이 60초다 —
30MB 스트리밍이 정상적으로 수십 초 걸려서, 10초 기준이면 성공한 호출이 느린 호출로 집계돼
서킷이 열리고 자동 갱신이 사실상 꺼진다.

다른 서비스도 외부 의존마다 인스턴스를 둔다 — `llm`(ai-service), `kakao`/`naver`(auth-service),
`kma`/`kma-warning`(tour-service). 서비스 간 Feign 호출은 대상 논리 서비스명을 인스턴스명으로
쓴다(`tour-service`/`auth-service`/`plan-service`) — `coding-conventions.md` §10.

## Grafana 대시보드 1차 구성

| 패널 | 쿼리 요지 |
| --- | --- |
| 서비스 가용성 | `up{project="hondigagae"}` |
| API p95 | `histogram_quantile(0.95, sum by (le, service) (rate(http_server_requests_seconds_bucket[5m])))` |
| 5xx 비율 | `sum by (service) (rate(http_server_requests_seconds_count{status=~"5.."}[5m]))` |
| **데이터 신선도** | `time() - place_import_last_success_timestamp` (소스별 stat 패널) |
| 배치 결과 | `place_import_rows` 소스·결과별 막대 |
| JVM 힙 | `jvm_memory_used_bytes{area="heap"}` |

## 빠른 점검

```bash
# 지표가 나오는지
curl -s http://{host}:{port}/actuator/prometheus | grep -c "^http_server_requests"

# 데이터 신선도 (구현 후)
curl -s http://{host}:{port}/actuator/prometheus | grep place_import_last_success

# 헬스
curl -s http://{host}:{port}/actuator/health
```
