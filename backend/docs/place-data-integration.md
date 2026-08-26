# 장소 데이터 통합 설계

> 관광 API만으로는 제주 반려견 동반 장소가 29곳뿐이고 식당·카페가 0곳이라 서비스가 성립하지 않는다.
> 부족분을 어떤 소스로 어떻게 메울지 정한 문서다. 실측 근거는 `data-api-analysis.md`, 엔티티는 `entity-design.md`.

## 1. 소스별 성격 — 저장 가능 여부가 설계를 가른다

| 소스 | 제주 규모 | DB 저장 | 갱신 | 쓰는 곳 |
|------|----------|---------|------|---------|
| 관광정보 GW (TourAPI) | 반려견 동반 29곳 / 전체 1,027곳 | **가능** | 주 1회 배치 | 장소 마스터 |
| 반려동물 동반여행 API | 29곳 (동반 정보 9필드) | **가능** | 주 1회 배치 | 장소 마스터의 동반 조건 |
| **한국문화정보원 문화시설** | 1,191곳 (여행용 171 + 병원 225) | **가능** | 파일 갱신 시 수동 | 장소 마스터 확장, 긴급 시설 |
| **카카오 로컬** | 제한 없음 | **금지** | — | 실시간 조회 전용 |

**카카오 로컬은 응답을 저장할 수 없다.** 카카오 공식 답변 기준으로 DB 영구 저장은 물론
세션 단위 임시 저장·캐싱도 허용되지 않고 실시간 호출만 가능하다. 이 제약이 아래 §5·§6 설계의 이유다.

## 2. 문화정보원 데이터

[data.go.kr/data/15111389](https://www.data.go.kr/data/15111389/fileData.do) — 파일데이터(CSV, 약 30MB, 전국 70,650행).
**활용신청 없이 다운로드**되므로 인증키가 필요 없다.

### 제주 1,191건의 구성

| 카테고리 | 건수 | 관광 API 대비 |
|---------|-----:|--------------|
| 동물약국 | 616 | 없던 분류 |
| 동물병원 | 225 (실제 86곳) | 없던 분류 |
| 여행지 | 63 | 23곳 |
| 펜션 | 58 | 2곳 |
| 반려동물용품 | 48 | 없던 분류 |
| 미용 | 43 | 없던 분류 |
| 박물관 | 26 | 1곳 |
| 카페 | 24 | 0곳 |

- 여행 코스 카테고리(의료·용품·미용 제외) **230곳**. 그중 동반 가능은 **171곳**(ALLOWED 154 + 부분 동반 17),
  동반 불가로 표시된 59곳도 함께 적재해 검색에서 "동반 불가"로 보여준다. 동반 가능 중 **실내 86곳**
- 좌표는 1,191건 **전부** 보유
- `반려동물 동반 가능정보`는 Y/N 2종, `입장 가능 동물 크기`는 "모두 가능" 1,029건 + "소형", "5kg 이하" 등 19종

### 컬럼 매핑

| CSV 컬럼 | place 매핑 | 비고 |
|---------|-----------|------|
| 시설명 | `title` | |
| 카테고리2/3 | `contentTypeId` 로 변환 | 펜션→32, 카페/여행지/박물관→12·39 등 매핑표 필요 |
| 시도/시군구 명칭 | `areaCode`/`sigunguCode` | 명칭→코드 역매핑 |
| 위도 / 경도 | `lat` / `lng` | 관광 API와 달리 이름 그대로다 |
| 도로명주소 / 지번주소 | `addr1` | 도로명 우선, 없으면 지번 |
| 전화번호 / 홈페이지 | `tel` / `homepage` | |
| 반려동물 동반 가능정보 | `petAvailable` + `petAllowanceType` | Y/N |
| 입장 가능 동물 크기 | `allowedPetSize`(신규) | 관광 API `acmpyPsblCpam` 과 같은 파서 사용. "해당없음" 58건은 UNKNOWN |
| 반려동물 제한사항 | `petRestriction`(신규) | 원문 보존. "야외만 반려동물 동반 가능" 15건은 부분 동반 판정에 쓴다 |
| 장소(실내)/(실외) 여부 | `indoor` / `outdoor`(신규) | **비 오는 날 대안 추천의 근거** |
| 반려동물 전용 정보 | `petOnly`(신규) | "반려동물 전용" 55건 |
| 애견 동반 추가 요금 | `petExtraFee`(신규) | |
| 휴무일 / 운영시간 | `place_intro.restDate` / `useTime` | 기존 테이블 재사용 |
| 최종작성일 | `sourceModifiedAt` | |

## 3. place 엔티티 확장

원천이 둘이 되므로 식별자 체계를 바꾼다.

```text
place  (추가/변경)
├─ source            VARCHAR(20)  NOT NULL   신규. TOUR_API / CULTURE_PORTAL
├─ source_key        VARCHAR(64)  NOT NULL   신규. 원천 식별자
│                                             TourAPI = contentId 문자열
│                                             문화정보원 = SHA256(시설명|도로명주소) 앞 32자
├─ content_id        BIGINT       NULL       변경. TourAPI 전용이라 nullable 로
├─ indoor            BOOLEAN      NOT NULL   신규. default false
├─ outdoor           BOOLEAN      NOT NULL   신규. default false
├─ pet_only          BOOLEAN      NOT NULL   신규. default false
├─ allowed_pet_size  VARCHAR(20)  NOT NULL   신규. enum AllowedPetSize (기존 place_pet_info 와 동일 enum)
├─ pet_restriction   VARCHAR(500) NULL       신규
├─ pet_extra_fee     VARCHAR(200) NULL       신규
└─ merged_into_id    BIGINT       NULL       신규. 중복 판정 시 살아남은 행을 가리킨다

uk_place_source_source_key   (source, source_key)     ← 새 원천키
idx_place_content_id         (contentId)              ← uk 에서 일반 인덱스로 강등
idx_place_indoor_pet_available (indoor, petAvailable) ← 실내 대안 추천용
```

`merged_into_id`가 채워진 행은 조회에서 제외한다. 물리 삭제하지 않는 이유는 원천 재적재 시 되살아나기 때문이다.

## 4. 중복 판정 규칙

실측(문화정보원 여행용 171곳 × 관광 API 29곳)으로 검증한 결과다.

| 규칙 | 결과 | 처리 |
|------|-----:|------|
| 정규화 이름 완전일치 + 좌표 1km 이내 | 7건 | **자동 병합** |
| 정규화 이름 부분일치 + 좌표 300m 이내 | 7건 | 병합 후보로 표시, 수동 확인 |
| 좌표만 150m 이내 (이름 다름) | 2건 | **병합하지 않는다** |

- 정규화 = 괄호·대괄호 안 제거 → 공백·기호 제거 → 소문자
- 좌표만 근접한 건은 실제로 별개다. `녹차미로공원`과 `쉼한모금`이 93m 거리에 따로 있다.
  반대로 `도치돌목장`과 `도치돌 알파카목장`(99m)은 같은 곳이라, 이름 부분일치가 좌표보다 신뢰도가 높다.
- 이름은 같은데 좌표가 먼 경우(`서우봉` vs `서우봉둘레길`)는 원천마다 기준점이 달라서다(정상 vs 입구).
  그래서 완전일치 규칙의 반경을 1km로 넉넉히 잡았다.
- 병합 시 **관광 API 행을 살리고** 문화정보원 행에 `merged_into_id`를 채운다.
  관광 API가 이미지·개요·동반 정보 9필드를 갖고 있어 정보량이 많다.

## 5. 배치 잡

### CultureFacilityImportJob (신규)

```bash
# CSV 경로는 프로퍼티(culture-facility.file-path)로 준다. 기본값은 backend/data/pet_culture.csv 다.
./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=cultureFacilityImportJob sido=제주특별자치도"

# 다른 경로에 두었다면
CULTURE_FACILITY_CSV_PATH=/path/to/pet_culture.csv ./gradlew :service:batch-service:bootRun --args="..."
```

- 입력은 로컬 CSV 경로. API가 아니라 파일이라 읽기는 `adapter/out/file` 에 두고 `adapter/out/persistence` 로 upsert 한다
- CSV 원본은 30MB라 저장소에 커밋하지 않는다 (`.gitignore` 의 `backend/data/`). 재다운로드 주소는 §2
- `sido` 파라미터로 제주만 필터 (전국 70,650행 중 1,191행)
- upsert 키는 `(source, source_key)`. 재실행해도 같은 행을 갱신한다
- 적재 후 별도 스텝에서 §4 규칙으로 중복 판정 → `merged_into_id` 갱신
- CSV는 UTF-8 BOM. `utf-8-sig` 로 읽어야 첫 컬럼명이 깨지지 않는다

#### 적재 전 실측 검증

CSV 1,191행에 파서를 그대로 돌려 확인한 결과다.

| 항목 | 결과 |
|------|------|
| 여행 카테고리 필터 | 230곳 (contentTypeId 12=64, 14=78, 32=64, 39=24) |
| `petAllowanceType` | ALLOWED 154 / PARTIALLY_ALLOWED 17 / NOT_ALLOWED 59 |
| `allowedPetSize` | ALL 102 / SMALL_ONLY 43 / SMALL_MEDIUM 27 / UNKNOWN 58(원문 "해당없음") |
| 좌표·주소 결측 | 0곳 |
| `sourceKey` 충돌 | 2건 — CSV에 `외돌개`가 같은 이름·주소로 중복 등록돼 있다. upsert 라 한 행으로 합쳐진다 |

### PlaceImportJob (기존, 수정)

- `source=TOUR_API`, `source_key=contentId` 를 채우도록 upsert 컬럼 추가

## 6. 카카오 로컬 — 실시간 조회 전용

식당은 공공데이터로 메울 수 없다. 식품의약품안전처의 반려동물 동반출입 음식점 등록 현황은
전국 2,612곳 중 **제주가 0곳**이다(제도가 2026년 3월 시행이라 아직 등록이 없다).

### 설계 원칙

- **응답을 저장하지 않는다.** DB·Redis 어디에도 넣지 않고, 요청이 올 때마다 호출해 그대로 내려준다
- 따라서 `place` 테이블에 카카오 결과가 섞이지 않는다. 조회 경로가 완전히 분리된다
- 응답에 `place_url`(카카오맵 상세 링크)을 반드시 포함해 출처를 표시한다

### API

```text
GET /api/v1/places/nearby-dining?lat=33.25&lng=126.41&radius=2000&type=RESTAURANT&keyword=애견동반
```

- `type`: RESTAURANT(FD6) / CAFE(CE7) — 카카오 `category_group_code` 로 변환
- `keyword` 가 있으면 키워드 검색, 없으면 카테고리 검색
- 응답: 상호명·주소·좌표·전화·카테고리·카카오맵 링크·중심점 거리
- **동반 가능 여부는 확인된 값이 아니다.** 검색 결과일 뿐이므로 응답에 그 사실을 명시하는 플래그를 둔다

### 어댑터

```text
application/port/out/NearbyDiningQueryPort      (도메인 책임 이름 — 카카오가 드러나지 않는다)
adapter/out/client/KakaoLocalClientAdapter
adapter/out/client/kakao/KakaoLocalClient       (WebClient HTTP Interface)
adapter/out/client/kakao/dto/*ClientResponse    (원본 DTO — adapter 밖으로 내보내지 않는다)
```

- `https://dapi.kakao.com/v2/local/search/{keyword|category}.json`, 헤더 `Authorization: KakaoAK {REST_API_KEY}`
- `radius` 최대 20,000m, `size` 최대 15, `page` 최대 45
- 일 10만 호출(앱 단위). 서킷 인스턴스 `kakao-local`, connect 2s / read 3s
- 실패 시 빈 목록이 아니라 도메인 예외(503)로 올려 프론트가 "지금은 주변 검색이 안 된다"고 안내하게 한다

## 7. AI 플래너의 식사 슬롯

저장할 수 없는 데이터를 일정에 미리 넣을 수 없다. 슬롯만 만들고 장소는 현장에서 찾는다.

- AI가 만드는 일정의 식사 항목은 `PlanItemType.MEAL` + `targetId = null` + `title = "점심 식사"` 형태
- 앱에서 그 항목을 열면 그 시각 동선의 좌표로 `nearby-dining` 을 호출해 후보를 보여준다
- 사용자가 특정 식당을 고르면 **이름과 메모만** `plan_item` 에 저장한다. 좌표·URL은 저장하지 않는다
- 이러면 카카오 제약을 지키면서도 "지금 근처에서 밥 먹을 곳"이라는 여행 중 실사용 가치는 살아 있다
  (기획 후보 ⑦ AI 여행 비서의 성격과 맞는다)

## 8. 작업 순서

1. `place` 엔티티 확장 + 마이그레이션 (§3)
2. `PlaceImportJob` 에 `source`/`source_key` 추가 (§5)
3. `CultureFacilityImportJob` 신규 + 중복 판정 스텝 (§5, §4)
4. tour-service 장소 검색에 `indoor`·`allowedPetSize` 필터 추가
5. tour-service `nearby-dining` + 카카오 어댑터 (§6)
6. 긴급 시설 조회 — 문화정보원 동물병원으로 `emergency` 컨텍스트 구현 (§9)

1~3이 끝나면 장소 마스터가 **190곳**(관광 29 + 문화정보원 171 − 중복 10)이 된다.

## 9. 동물병원 (긴급 시설)

같은 CSV 안에 동물병원이 섞여 있어 한 번 읽는 김에 같이 적재한다. 다만 여행 장소가 아니라
**긴급 상황용**이므로 `place` 가 아닌 `animal_hospital` 테이블로 분리했다. 여행 일정 후보에
동물병원이 섞여 들어가는 것을 막기 위해서다.

### 9-1. 실측한 데이터 품질

| 항목 | 수치 | 설계에 미친 영향 |
| --- | --- | --- |
| 제주 행 수 | 225 | — |
| **실제 병원 수** | **86** | 이름·주소·좌표가 완전히 같은 중복 139건. `source_key`(이름+주소 해시) UK 로 upsert 하면 자동 정리된다 |
| 좌표 보유 | 225 / 225 | 반경 검색을 좌표만으로 할 수 있다 |
| 전화번호 보유 | 224 / 225 | 긴급 상황의 실질 행동은 "전화 걸기"라 응답에 반드시 싣는다 |
| **운영시간 없음** | **111 / 225 (49%)** | null 을 "휴무"로 오해하면 안 된다. 응답에 `operatingHoursKnown` 플래그를 따로 내려 화면이 "영업시간 정보 없음"으로 표시하게 한다 |
| **24시간 운영** | **3곳** | `open24Only=true` 는 결과가 매우 적다. 기본값을 false 로 두고, 켰을 때 결과가 적은 것이 정상임을 API 설명에 적었다 |

`open24` 판정에서 **"연중무휴"를 24시간으로 보지 않는다.** 연중무휴는 매일 연다는 뜻이지
하루 24시간 연다는 뜻이 아니다 — 실제로 "연중무휴 / 14:00~20:00" 인 병원이 있다.
상호에 `24시` 가 있거나 운영시간이 `00:00~24:00` 인 경우만 true 다
(`OperatingHoursParser`). 첫 정규식이 "연중무휴"에 오탐해 24시간 병원을 부풀렸던 자리라
규칙을 여기 남긴다.

### 9-2. 반경 검색

`GET /api/v1/emergencies/animal-hospitals?lat=&lng=&radius=&open24Only=&size=`

DB 는 좌표 **사각 범위**로만 1차 필터하고(`AnimalHospitalRepository.findWithinBox`),
정확한 원형 반경과 거리 정렬은 애플리케이션에서 계산한다(`GeoDistance`, 하버사인).
제주 전체가 86곳뿐이라 메모리 정렬 비용이 무시할 수준이고, DB 에 삼각함수를 넣는 것보다
이식성이 좋다. **규모가 커지면 공간 인덱스로 옮겨야 하는 지점**이라 Processor 주석에 표시해 두었다.

`open24` 필터는 `Boolean` 을 받아 `null` 이면 조건 자체를 끄는 방식이다
(`:open24 is null or h.open24 = :open24`).

### 9-3. 검증

JPQL 은 컴파일로 검증되지 않아 `AnimalHospitalRepositoryTest` 에서 H2 로 실제 스키마를 만들고
질의한다. 이 테스트가 잡아낸 실제 결함이 하나 있다 — `@Comment` 안의 작은따옴표를 Hibernate 가
이스케이프하지 않아 `comment on column` DDL 이 깨졌다. 엔티티 코멘트에는 작은따옴표를 쓰지 않는다.
