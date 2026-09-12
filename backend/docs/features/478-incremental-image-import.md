# [BE] feat: 추가 이미지(detailImage2) 적재를 증분 대상 선정으로 바꾼다

> 이슈: [#478](https://github.com/8llow8llowMe/hondigagae/issues/478)
> 상태: 구현 완료
> 대상: batch-service `placeimport` 컨텍스트 + tour-service `PlaceEntity` (컬럼 한 개)

## 무엇이 문제였나

`placeImageImportStep` 이 **매 실행 TourAPI 장소 전량**에 `detailImage2` 를 부른다.
대상 쿼리(`JdbcPlaceImageBulkAdapter.SELECT_TARGETS_SQL`)에 `ORDER BY` 도 `LIMIT` 도 없었다.
제주 기준 964콜이고, TourAPI 개발계정 쿼터는 **일 1,000건**이다.

그 대부분은 **바뀌지 않은 장소를 다시 받는 호출**이다. 이미지는 이미 적재돼 있고, 원천이
갤러리를 자주 바꾸지 않는다.

#361 이 운영시간 수집(`placeIntroImportStep`, 상한 300)을 같은 예산 위에 올리면서 이 낭비가
실제 제약이 됐다. #361 은 스텝 순서를 바꿔(운영시간 → 이미지) 자기 몫을 먼저 확보했고,
이미지 스텝은 남은 예산(약 680)까지 돌다 한도에 닿으면 조용히 끝낸다. 즉 지금은
**매 실행 약 280곳의 이미지 갱신이 그냥 빠진다.** 어느 280곳인지도 정해져 있지 않다 —
정렬이 없어 MySQL 이 돌려주는 순서가 곧 우선순위였다.

순서를 바꾼 쪽이 계속 손해를 보는 구조를 고정해 두는 대신, 두 스텝이 모두 예산 안에서 돌게 만든다.

## 판단 1 — 커서를 어디에 둘 것인가

증분 선정은 "마지막으로 언제 확인했나" 를 어딘가에 적어 둬야 성립한다. 운영시간 쪽은
`place_intro.synced_at` 이 그 자리였다. 이미지 쪽은 쓸 수 있는 자리가 없었다.

| 후보 | 왜 안 되는가 |
| --- | --- |
| `place_image.synced_at` 의 최댓값 | **이미지가 0장인 장소는 행이 아예 없다.** 원천이 갤러리를 주지 않는 장소가 약 30% 인데, 그 전부가 "한 번도 확인 안 함" 버킷에 영원히 남아 순환의 머리를 독식한다 |
| `place_image` 에 빈 행을 하나 넣어 커서로 쓴다 | `origin_img_url`·`serial_num` 이 NOT NULL 이고 `uk_place_image_place_id_serial_num` 이 걸려 있다. 커서를 위해 가짜 URL 을 만들면 그 행이 상세 갤러리로 새어 나간다 |
| `place.synced_at` | 목록 upsert(`placeImportStep`)가 **매 실행 전량을 갱신**한다. 이미지 확인 여부와 무관한 값이라 커서가 되지 못한다 |
| **`place.image_synced_at` 신규 컬럼** ← 채택 | 장소당 정확히 한 행이고, 이미지가 0장이어도 값을 남길 수 있다. 목록 upsert 가 건드리지 않는다(아래) |

### 컬럼은 tour-service 가 정의하고 값은 batch 만 채운다

`merged_into_id` · `delisted_at` 과 같은 방식이다 (`place-data-integration.md` 의 규칙).
tour-service 의 `PlaceEntity` 가 컬럼을 선언해 `ddl-auto` 가 dev/local 스키마를 만들고,
값을 쓰는 것은 batch-service 의 JDBC 어댑터뿐이다.

**tour-service 는 이 컬럼을 읽지 않는다.** 리포지터리·매퍼·`Info`·응답 DTO 어디에도 넣지 않았다 —
적재 진행 상태는 운영 정보이지 API 계약이 아니다.

### 목록 upsert 가 이 값을 덮지 않는다

`JdbcPlaceBulkAdapter` 의 `place` upsert 3종은 `ON DUPLICATE KEY UPDATE` 에 **갱신할 컬럼을
명시 나열**한다. 새 컬럼을 더해도 목록 적재가 매 실행 이 값을 밀어 버리지 않는다 —
`INSERT ... ON DUPLICATE KEY UPDATE` 가 컬럼을 통째로 덮는 형태였으면 이 설계 자체가 성립하지 않는다.
이 전제가 깨지면(누군가 upsert 를 전체 컬럼 방식으로 바꾸면) 증분이 조용히 무력화되고
매 실행 전량이 다시 대상이 된다.

## 판단 2 — 상한 400

```text
같은 날 최악 합 (주 1회 월요일)
  목록 (areaBasedList2 페이징)        약  17
  운영시간 (detailIntro2, 상한)           300
  이미지 (detailImage2, 상한)     ←       400
  수동 백필 (searchKeyword2, 최대)        276
  올레 코스                                 1
  ───────────────────────────────────────────
                                          994  < 1,000
```

- `placeImageBackfillJob`(searchKeyword2)은 **cron 에 없다 — 수동 실행 전용**이다. 그래도 같은 날
  돌릴 수 있으므로 최악 합에 넣는다. 276 은 문화정보원·식약처 원천 중 이미지 없는 장소 수다
- 964곳 전량 커버는 **3주 순환**이다 (`⌈964 / 400⌉ = 3`). 주 1회 cron(`0 0 3 ? * MON`)이라
  3주면 한 바퀴가 돈다. 이미지는 이미 적재돼 있는 데이터의 갱신이므로 이 주기로 충분하다
- 운영계정 키를 받으면 이 값을 올린다. 전량이 한 실행에 들어갈 만큼 올려도 코드는 그대로 동작한다
  (상한이 대상 수보다 크면 순환이 매 실행 전량을 돈다)

**`place-intro-import.max-calls-per-run`(300)은 건드리지 않았다.** 운영시간은 아직 없는 데이터라
진도를 늦출 이유가 없고, 400 은 그 300 을 유지한 채로 남는 예산에서 잡은 값이다.

## 판단 3 — 커서는 "원천에서 확정 답을 받았을 때만" 전진한다

증분 커서의 함정은 전부 여기 모여 있다. 규칙은 다섯 줄이다.

| 상황 | 처리 | 왜 |
| --- | --- | --- |
| 성공 (이미지 있음) | `replaceImages` + touch | 정상 경로 |
| 성공 (**빈 목록**) | `replaceImages([])` + touch | 안 하면 이미지 없는 30% 가 NULL 머리를 영원히 독식한다. 빈 목록 교체는 원천이 갤러리를 내렸을 때 우리도 내리는 기존 동작이기도 하다 |
| 그 밖의 한 곳 실패 | `failedPlaces++` + touch | 원천에서 사라진 `contentId` 처럼 **영영 실패하는 장소**가 머리에 고착하면 매 실행 그만큼의 예산이 아무것도 채우지 못하고 사라진다. 한 바퀴 뒤에 자연히 재시도된다 |
| `TOUR_API_QUOTA_EXCEEDED` | touch 없이 `break`, 스텝은 **성공**으로 끝낸다 | 종전과 같다. 남은 장소를 계속 두드려도 전부 같은 실패다. 채우지 못한 장소는 커서 앞자리에 그대로 남는다 |
| `TOUR_API_CIRCUIT_OPEN` · `TOUR_API_SERVICE_KEY_MISSING` | touch 없이 **다시 던진다** | ← 행동 변화다. 아래 |

### 행동 변화 — 서킷 오픈·키 누락이 이제 스텝을 실패시킨다

**종전**: 두 오류가 "한 곳 실패" 로 접혀 964번 찍히고 스텝은 `COMPLETED` 로 끝났다. 대상 선정이
무상태라 잃는 것이 없었다 — 다음 실행이 같은 964곳을 다시 돌았다.

**이제**: 순환 커서가 생겼으므로 그 한 번에 **상한(400)만큼의 장소가 아무것도 받지 못한 채 커서만
밀린다.** 그 400곳은 순환이 한 바퀴(3주) 돌기 전까지 다시 오지 않는다. 키를 빠뜨린 배포 한 번이
3주짜리 공백을 만드는 셈이다.

`PlaceIntroImportProcessor` 가 이미 같은 판단을 하고 있었다(`STOPS_THE_STEP`). 두 프로세서가 같은
규칙을 각자 적어 두면 한쪽만 고쳐지므로, 그 집합을 `PlaceImportErrorCode.stopsTheStep(...)`
정적 헬퍼로 올려 **두 프로세서가 공유**한다.

스텝이 실패하면 잡이 실패하고 모니터링에 뜬다. 그게 맞는 결과다 — 키가 없거나 원천이 죽은 상태를
`COMPLETED` 로 덮으면 아무도 모르는 채로 커버리지만 조용히 떨어진다.

## 무엇을 바꿨나

### tour-service (읽지 않는 컬럼 하나)

```java
@Comment("추가 이미지(detailImage2) 마지막 확인 시각. null 이면 아직 한 번도 부르지 않았다. 목록 upsert 는 이 값을 건드리지 않는다")
private LocalDateTime imageSyncedAt;
```

### batch-service

- `PlaceImageBulkPort#findTourApiTargets(int limit)` — 시그니처에 상한이 붙었다.
  `limit <= 0` 이면 쿼리 없이 빈 목록(운영시간 포트와 같은 규칙)
- `PlaceImageBulkPort#touchImageSyncedAt(long placeId)` 신설. 커서가 `place` 행에 있으니
  단순 `UPDATE` 다 (운영시간 쪽은 `place_intro` 행이 없을 수 있어 upsert 였다)
- `PlaceImageImportProperties` (prefix `place-image-import`, 기본 400)
- `PlaceImportErrorCode.stopsTheStep(...)` — 두 프로세서가 공유하는 판정

**대상 선정 SQL** — 운영시간과 같은 3단 정렬이다.

```sql
SELECT p.id, p.content_id
  FROM place p
 WHERE p.source = 'TOUR_API'
   AND p.content_id IS NOT NULL
   AND p.merged_into_id IS NULL
   AND p.delisted_at IS NULL
 ORDER BY p.image_synced_at IS NULL DESC, p.image_synced_at ASC, p.id ASC
 LIMIT ?
```

MySQL 은 `IS NULL` 이 불리언 0/1 이라 `DESC` 로 정렬하면 NULL(=1)이 앞에 온다. 마지막 `p.id` 는
동률을 가르는 결정적 기준이다 — 없으면 어느 행이 상한 안에 드는지 실행마다 달라져, 왜 이 장소가
빠졌는지 나중에 설명할 수 없다.

## 마이그레이션

- local/dev (`ddl-auto: update`) — tour-service 기동 시 컬럼이 생긴다
- prod (`ddl-auto: none`) — 배포 전에 아래를 적용한다 (`deploy-guide.md` 의 수동 DDL 런북)

```sql
ALTER TABLE place
  ADD COLUMN image_synced_at DATETIME(6) NULL
  COMMENT '추가 이미지(detailImage2) 마지막 확인 시각. null 이면 아직 한 번도 부르지 않았다';
```

- **`DATETIME(6)` 이어야 한다.** Hibernate 6 은 `LocalDateTime` 을 `datetime(6)` 으로 만든다.
  `DATETIME` 으로 적으면 prod 스키마가 dev 와 갈린다 — #398 이 `checked` 를 `BOOLEAN` 으로 적어
  겪은 것과 같은 타입 드리프트다
- 인덱스는 넣지 않는다. 964행 테이블의 `ORDER BY ... LIMIT 400` 이라 풀스캔 + filesort 가
  주 1회 수십 ms 다. 인덱스를 만들어도 `image_synced_at IS NULL DESC` 표현식 정렬이라
  어차피 쓰이지 않는다

### 배포 순서 — tour-service 가 먼저다

```text
1. prod DDL 적용 (위 ALTER TABLE)         ← 또는 tour-service 배포로 dev/local 은 자동
2. tour-service 배포                       ← 컬럼을 정의하는 쪽
3. batch-service 배포                      ← 컬럼을 읽고 쓰는 쪽
```

**순서가 뒤집히면 batch-service 가 없는 컬럼에 질의해 `placeImageImportStep` 이 통째로 죽는다.**
컬럼을 정의하는 쪽과 쓰는 쪽이 다른 서비스라 생기는 제약이고, `merged_into_id`·`delisted_at` 때와
같다. 반대로 tour-service 만 먼저 나가는 것은 무해하다 — 컬럼이 생기고 아무도 읽지 않을 뿐이다.

## 커버리지는 로그로 본다

```text
place image import finished. targets=400, processedPlaces=400, images=1183,
emptyImages=118, failedPlaces=3, quotaExhausted=false
```

- `targets` 가 상한(400)보다 작으면 대상 자체가 그만큼인 것이다
- **두 번째 실행의 대상이 첫 실행과 겹치지 않아야 한다** — 겹치면 touch 가 안 걸린 것이다
- `quotaExhausted=true` 면 진도는 `processedPlaces` 만큼이다. `targets` 가 아니라 그 값을 누적해 본다

## 남은 것

- **SQL 은 자동 검증이 얕다.** 바인딩과 SQL 문구는 `JdbcTemplate` 을 모킹한 단위 테스트로
  고정했지만 SQL 자체는 실행되지 않는다. 특히 `ORDER BY p.image_synced_at IS NULL DESC` 는
  MySQL 전용 의미론이라 H2 로 검증할 수 없다 — dev 반영 뒤 `EXPLAIN` 한 번으로 메운다 (#361 과 같다)
- **전량 커버까지 3주다.** 그 사이에는 여전히 갱신이 밀린 장소가 있다. 운영계정 키를 받으면
  상한만 올리면 된다
- **원천이 이미지를 내린 장소의 반영도 3주 안쪽으로 밀린다.** 종전에는 (예산이 닿는 한) 매 실행
  반영됐다. 상세 갤러리가 최대 3주 낡을 수 있다는 뜻인데, 이미 지금도 약 280곳은 아예 갱신되지
  않으므로 평균적으로는 나아진다
