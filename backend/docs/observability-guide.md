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
place_import_rows{source, result}            # upserted / delisted / geocode_failed
place_import_last_success_timestamp{source}  # 소스별 마지막 성공 시각(epoch seconds)
```

`source` 는 `PlaceSourceType` 이름(`TOUR_API` / `CULTURE_PORTAL` / `MFDS`)이다.
`inserted/updated` 를 나누지 않는 이유: 적재가 JdbcTemplate upsert 라 구분해 세지 않고,
경보도 그 구분을 쓰지 않는다.

경보 기준.

| 조건 | 심각도 | 뜻 |
| --- | --- | --- |
| `time() - place_import_last_success_timestamp{source="MFDS"} > 14d` | 경고 | 주 1회 잡이 2주간 성공 못함 |
| `place_import_rows{result="geocode_failed"} > 10` | 경고 | VWorld 응답 이상 또는 주소 형식 변화 |
| `place_import_rows{result="delisted"} > 30` | **심각** | 원천 이상 의심. 급감 가드가 놓쳤을 수 있다 |

마지막 항목이 중요하다. delisting 은 잘못 돌면 데이터를 통째로 날리므로,
급감 가드(`data-refresh-guide.md` 2절)와 이 경보가 이중 방어선이다.

**구현 방식** (batch-service `placeimport` 도메인, `PlaceImportMetricsPort` +
`MicrometerPlaceImportMetricsAdapter`):

- `place_import_rows` 는 Counter 가 아니라 **마지막 실행 값을 담는 Gauge** 다.
  위 경보 기준이 실행 단위 값을 전제하기 때문이다. Counter 누적값은 `increase()` 없이
  실행 단위를 읽을 수 없다.
- `last_success` 는 **단조 증가**로만 갱신하고, **실제로 데이터가 들어온 실행(imported > 0)**
  만 성공으로 친다. 원천이 빈 응답을 준 실행을 성공으로 남기면 경보가 침묵한다.
- 게이지는 프로세스 메모리에만 있으므로, 기동 시 `PlaceImportMetricsSeeder` 가
  Spring Batch 메타데이터에서 잡별 마지막 COMPLETED 실행 종료 시각을 **씨딩**한다.
  배포 직후에도 신선도 패널이 비지 않는다. `place_import_rows` 는 씨딩하지 않아
  재기동 후 첫 실행 전까지는 값이 없다 — 없는 것이 0 으로 보이는 것보다 낫다.
- 긴급 시설·이미지 잡·혼잡도 잡은 이 지표에 넣지 않는다. `place_import_rows` 는
  장소 마스터 기준이고, 긴급 시설은 급감 가드 + 경고 로그가 별도로 지킨다.

## 외부 API 지표

Resilience4j 가 자동으로 노출한다. 현재 서킷 인스턴스는 없고 기본 정책만 정의돼 있다
(기상청 연동 시 추가 예정).

```
resilience4j_circuitbreaker_state{name}
resilience4j_circuitbreaker_calls_seconds_count{name, kind="successful|failed"}
```

VWorld·식약처는 batch-service 에서만 부르고 서킷을 걸지 않았다. 배치는 실패해도
사용자 요청을 막지 않으므로 서킷보다 재실행이 맞는 대응이다.

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
