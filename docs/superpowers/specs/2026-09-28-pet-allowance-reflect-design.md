# 장소 동반 가능 여부 반영 — `place.pet_allowance_type` · `allowed_pet_size` 재계산

> 대상: `backend/service/batch-service` `domainlayer/placeimport`
> 작성: 2026-09-28
> 상태: **설계 확정** (#886)

**Goal:** TourAPI 장소의 `place.pet_allowance_type` · `allowed_pet_size` 를 이미 적재된 두 근거 —
`place_pet_info`(#877) 와 **병합으로 흡수된 행**(`merged_into_id`) — 로 채운다. 목록 필터 · 적합도 ·
AI 후보 선정이 전부 이 두 컬럼을 보는데, TourAPI 2,095곳이 전부 `UNKNOWN` 이다.

**Non-goal:** 원천 적재 로직 변경(`petTourImportJob` 의 호출·저장, 문화정보원·식약처 파싱). 새 원천.
tour-service · plan-service · ai-service 코드 변경(읽는 쪽은 이미 이 컬럼을 본다). 자유 텍스트
규칙 확장(`PetFieldParser` 의 크기·범위 규칙은 #877 그대로 쓴다).

---

## 1. 실측 (2026-09-28 dev, 읽기 전용)

**지금 무엇이 비어 있나.**

| 대상 | 값 |
| --- | --- |
| TourAPI 노출(`merged_into_id IS NULL`, 활성) | 2,095 — `pet_allowance_type` **전부 UNKNOWN** |
| `place_pet_info` | 330 — `acmpyTypeCd` 는 `전구역 동반가능` 302 · `일부구역 동반가능` 28 **두 값뿐** |
| 크기 제한(`place_pet_info.allowed_pet_size`) | UNKNOWN 277 · ALL 37 · SMALL_ONLY 11 · SMALL_MEDIUM 5 |
| 문화정보원 → TourAPI 흡수 | 101 행. **병합이 `pet_allowance_type` 을 옮기지 않아** 그 마스터도 UNKNOWN 이다 |
| 두 근거가 겹치는 마스터 | 20 — 그중 16 이 값이 다르다(문화정보원 ALLOWED ↔ 반려동물 API 일부구역 13 등) |

**그래서 무엇이 막혀 있나.**

- **AI 일정 후보에 TourAPI 장소가 한 곳도 없다.** ai-service `PlaceCandidateClientAdapter` 가 후보를
  `petAllowanceType=ALLOWED` 로 고정해 조회한다. 지금 AI 후보는 문화정보원·식약처분뿐이다.
- 적합도(`SuitabilityEvaluator`)가 UNKNOWN 에 감점 10 을 준다 — 동반 조건이 확인된 330곳도 감점된다.
- 문화정보원이 "동반 불가"로 확인한 29곳이 TourAPI 로 흡수되며 UNKNOWN 이 됐다. 목록 필터에서
  "모름" 으로 섞여 나간다.

**재계산하면 (같은 날 SQL 모의, §3 규칙).**

| 결과 | 곳 | 근거 |
| --- | --- | --- |
| ALLOWED | **342** | 반려동물 API 만 296 · 흡수 행만 42 · 둘 다 4 |
| PARTIALLY_ALLOWED | **39** | 반려동물 API 만 14 · 흡수 행만 9 · 둘이 달라 제한적인 쪽 16 |
| NOT_ALLOWED | **29** | 흡수 행(문화정보원) |
| UNKNOWN | 1,685 | 근거 없음 |

## 2. 결정

### 2-1. 어디서 — 매 실행 **재계산**하는 스텝

`place_pet_info` 를 쓸 때 `place` 를 같이 UPDATE 하는 방식은 고르지 않는다. 흡수 행(문화정보원)의
값을 못 보고, 동반 정보가 내려가 `place_pet_info` 가 지워졌을 때 되돌리지 못한다.

대신 **두 근거에서 결과를 다시 계산해 덮는 스텝** 하나를 둔다 — 입력이 같으면 결과가 같다(멱등),
근거가 사라지면 값도 돌아간다.

- 위치: `petTourImportJob` 의 적재 스텝 **뒤**, 그리고 `placeMergeJob` 의 병합 스텝 **뒤** — 스텝 정의
  `placePetAllowanceReflectStep` 하나를 두 잡이 붙인다(복사하지 않는다). 파이프라인에서는 병합(4) → … → 반려동물(6)
  순이라 두 번 돌지만 근거 읽기 한 번 + 바뀐 행만 갱신이라 싸다. 둘 중 하나만 손으로 돌려도 반영된다.
- 방식: **근거를 한 번에 읽고(SELECT) → 규칙을 Java(`PetAllowancePolicy`)로 적용 → 값이 바뀐 행만 배치 UPDATE.**
  `UPDATE place p LEFT JOIN (...) SET ...` 한 문장은 고르지 않았다 — 다중 테이블 UPDATE 는 H2(MODE=MySQL)가 받지 않아
  실제 SQL 을 테스트로 돌릴 수 없고, H2 가 받는 상관 하위 질의 UPDATE 는 흡수 행을 같은 `place` 에서 읽어야 해 MySQL 이
  ER_UPDATE_TABLE_USED(1093)로 거부한다. 대상이 2,100곳 남짓이라 읽고 쓰는 편이 두 DB 에서 같은 SQL 로 돈다.
- 대상: **TourAPI 노출 행만** (`source='TOUR_API' AND merged_into_id IS NULL AND delisted_at IS NULL`).
  문화정보원·식약처 노출 행은 자기 적재가 소유한다 — 건드리지 않는다.
- 다음 적재가 지우지 않는다: TourAPI upsert 는 이 두 컬럼을 INSERT 리터럴로만 쓰고 UPDATE 절에 두지 않는다
  (`JdbcPlaceBulkAdapterSqlTest` 가 고정). 병합이 하던 `allowed_pet_size` 채우기(survivor 가 UNKNOWN 일 때만)는
  **걷는다** — 재계산이 흡수 행을 근거로 같은 값을 내므로 중복이고, 규칙이 다른 두 쓰기(survivor 우선 ↔ 가장 제한적인 쪽)가
  한 칸에 겹치지 않게 한다. 병합이 두 칸을 쓰지 않는 것도 같은 테스트가 고정한다.

### 2-2. 동반 가능 여부 — **더 제한적인 쪽** (사용자 결정, 2026-09-28)

근거마다 값을 뽑고 **가장 제한적인 값**을 쓴다. 근거가 하나도 없으면 UNKNOWN.

| 근거 | 값 |
| --- | --- |
| `place_pet_info.allowance_scope` | FULL_AREA → ALLOWED · PARTIAL → PARTIALLY_ALLOWED · OUTDOOR_ONLY → PARTIALLY_ALLOWED · UNKNOWN → (근거 아님) |
| 흡수 행(`merged_into_id = 이 행`, `delisted_at IS NULL`)의 `pet_allowance_type` | 그대로. UNKNOWN 은 근거 아님 |

제한 순서: `NOT_ALLOWED` > `PARTIALLY_ALLOWED` > `ALLOWED`.

**왜 제한적인 쪽인가.** "전 구역 가능" 을 믿고 갔다가 못 들어가는 쪽이 사용자에게 더 나쁘다. 반대로
"일부만" 이라 했는데 실제로 다 되는 것은 손해가 작다.

**`place_pet_info` 행이 없는 곳을 NOT_ALLOWED 로 읽지 않는다.** 동반여행 목록에 없다는 것은 "모른다" 이지
"안 된다" 가 아니다.

**delist 된 흡수 행은 근거에서 뺀다.** 원천이 더는 내지 않는 장소의 값이라 "근거가 사라지면 값도 돌아간다" 에
맞춘다. 재등장하면 적재가 `delisted_at` 을 비우고 다음 실행에서 다시 근거가 된다. §1 모의는 이 조건 없이 셌으므로
실제 수치가 조금 작을 수 있다.

### 2-3. 크기 제한 — 같은 원칙

| 근거 | 값 |
| --- | --- |
| `place_pet_info.allowed_pet_size` | 그대로. UNKNOWN 은 근거 아님 |
| 흡수 행의 `allowed_pet_size` | 그대로. UNKNOWN 은 근거 아님 |

제한 순서: `SMALL_ONLY` > `SMALL_MEDIUM` > `ALL`. 근거가 없으면 UNKNOWN.

예전 병합이 채우던 `allowed_pet_size`(흡수 행 값, survivor 가 UNKNOWN 일 때만)는 이 규칙의 한 경우였다 —
재계산이 같은 근거에 반려동물 API 근거를 더하므로 병합 쪽 쓰기는 걷었다(§2-1).

### 2-4. 로그 · 검증

- 재계산 스텝은 완료 로그 한 줄에 **재계산 뒤 대상 전체의 값별 분포**와 **이번에 바뀐 행 수**를 남긴다 —
  `pet allowance reflected. targets=… changed=… ALLOWED=… PARTIALLY_ALLOWED=… NOT_ALLOWED=… UNKNOWN=… sizeRestricted=…`.
  분포는 §1 모의 · 확인 SQL 과 바로 대조되고, `changed` 는 두 번째 실행에서 0 이어야 한다(멱등 확인).
- 급변 가드는 두지 않는다 — 입력이 이미 적재된 두 테이블이고, 적재 쪽에 가드가 있다(#828 `ImportVolumeGuard`,
  #877 showflag 명시 삭제만).

## 3. 영향 — 읽는 쪽 (코드 변경 없음)

| 읽는 곳 | 바뀌는 것 |
| --- | --- |
| ai-service 후보(`petAllowanceType=ALLOWED` 고정) | TourAPI **342곳**이 처음으로 후보에 들어간다 |
| 적합도 | 381곳(ALLOWED + PARTIAL)의 UNKNOWN 감점이 사라진다. NOT_ALLOWED 29곳은 배제 판정 |
| 목록 필터(`petAllowanceType` 등치) | ALLOWED · PARTIALLY · NOT_ALLOWED 필터에 TourAPI 가 잡힌다 |
| 크기 필터(`petSizeType`) | 제한이 확인된 곳만 빠진다 — UNKNOWN 은 기존대로 통과 |

## 4. 운영

- 배포 뒤 `petTourImportJob`(또는 `placeMergeJob`) 한 번이면 dev 전량이 반영된다. 매주 월요일 파이프라인이 이어 받는다.
- 확인 SQL 은 `backend/docs/data-refresh-guide.md` §10 에 둔다.
