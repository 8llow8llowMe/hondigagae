# 엔티티 설계 (관광 데이터 적재)

> 2026-08-24 승인 키로 7개 API 전부 **실호출 검증 완료** — 이 문서의 컬럼은 실제 응답 필드 기준이다.
> 원천/상세 응답 기록은 `data-api-analysis.md` 참고.
> 컨벤션: PK는 `id`(Snowflake, `Long`), JPA 연관관계 어노테이션 금지(raw FK), 인덱스 명명·`@Comment` 규칙은 `coding-conventions.md` §9.

## 0. 전체 구조

```text
[KorService2 / KorPetTourService2]           [Durunubi]
place ──1:1── place_intro                    walk_route ──1:N── walk_course
  │──1:1── place_pet_info
  │──1:N── place_image

[TatsCnctrRateService / TarRlteTarService1]  ← contentId 없음(명칭+해시코드 기반)
stat_spot ──1:N── congestion_forecast
  │──1:N── related_place
  └─(place_id nullable 매칭)──> place

[DataLabService]                              [기상청]
area_visitor_stat                             (Redis 캐시 기본, weather_forecast는 선택)
```

- 소유 서비스: 전부 **tour-service** 조회 대상. 적재는 **batch-service**가 수행 (동일 DB).
- 공통 감사 컬럼(`created_at`, `updated_at`)은 `persistence-core BaseEntity`가 담당 — 아래 표에서 생략.
- 모든 적재 테이블은 `synced_at`(적재 시각)을 갖고, upsert 기준 UK를 명시한다 (재실행 가능 배치).

## 1. place — 장소 마스터

원천: `KorService2 areaBasedList2/detailCommon2` + `KorPetTourService2 areaBasedList2` (동일 contentid 체계 — 실호출로 확인).
반려동물 서비스에 존재하는 contentid는 `pet_available=true`로 마킹한다.

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK. batch 는 `PlaceIdFactory` 로 원천에서 결정적으로 만든다 |
| source | VARCHAR(20) | N | (원천 구분) | TOUR_API / CULTURE_PORTAL |
| source_key | VARCHAR(64) | N | (원천 식별자) | TourAPI=contentId, 문화정보원=시설명+주소 해시. **(source, source_key) 가 UK** |
| content_id | BIGINT | Y | contentid | TourAPI 콘텐츠 ID (문화정보원이면 null) |
| content_type_id | VARCHAR(2) | N | contenttypeid | 12관광지/14문화/15축제/25코스/28레포츠/32숙박/38쇼핑/39음식점 (enum `ContentType`) |
| title | VARCHAR(200) | N | title | 명칭 |
| addr1 | VARCHAR(200) | Y | addr1 | 주소 |
| addr2 | VARCHAR(100) | Y | addr2 | 상세주소 |
| zipcode | VARCHAR(10) | Y | zipcode | 우편번호 (목록 응답에 포함 확인) |
| area_code | VARCHAR(4) | Y | areacode | 관광 지역코드 (제주=39) |
| sigungu_code | VARCHAR(6) | Y | sigungucode | 관광 시군구코드 |
| ldong_regn_cd | VARCHAR(2) | Y | lDongRegnCd | 법정동 시도코드 (제주=50) |
| ldong_signgu_cd | VARCHAR(4) | Y | lDongSignguCd | 법정동 시군구코드 (제주시=110, 서귀포시=130) |
| cat1 / cat2 / cat3 | VARCHAR(4/6/10) | Y | cat1~3 | 구 카테고리 대/중/소 |
| lcls_systm1 / 2 / 3 | VARCHAR(4/6/10) | Y | lclsSystm1~3 | 신 분류체계 대/중/소 |
| lat | DECIMAL(13,10) | Y | **mapy** | 위도 (이름 바꿔 저장 — 혼동 차단) |
| lng | DECIMAL(13,10) | Y | **mapx** | 경도 |
| mlevel | TINYINT | Y | mlevel | 지도 레벨 |
| first_image | VARCHAR(300) | Y | firstimage | 대표 이미지 원본 |
| first_image2 | VARCHAR(300) | Y | firstimage2 | 대표 이미지 썸네일 |
| cpyrht_div_cd | VARCHAR(10) | Y | cpyrhtDivCd | 저작권 (Type1/Type3 — 출처표기 의무) |
| tel | VARCHAR(100) | Y | tel | 전화번호 |
| homepage | TEXT | Y | homepage (detailCommon2) | HTML anchor 포함 원문 |
| overview | TEXT | Y | overview (detailCommon2) | 개요 |
| pet_available | BOOLEAN | N | (KorPetTourService2 존재 여부) | 반려동물 동반 콘텐츠 여부, default false |
| pet_allowance_type | VARCHAR(20) | N | (가공) | enum `PetAllowanceType`: ALLOWED / PARTIALLY_ALLOWED / NOT_ALLOWED / UNKNOWN, default UNKNOWN |
| source_created_at | DATETIME | Y | createdtime | 원천 등록일 (`yyyyMMddHHmmss` 파싱) |
| source_modified_at | DATETIME | Y | modifiedtime | 원천 수정일 — **증분 동기화 기준** |
| indoor / outdoor | BOOLEAN | N | (문화정보원) | 실내·실외 여부. 비 오는 날 대안 추천 근거 |
| pet_only | BOOLEAN | N | (문화정보원) | 반려동물 전용 시설 |
| allowed_pet_size | VARCHAR(20) | N | (가공) | enum `AllowedPetSize` |
| pet_restriction | VARCHAR(500) | Y | (문화정보원) | 제한사항 원문 |
| pet_extra_fee | VARCHAR(200) | Y | (문화정보원) | 동반 추가 요금 원문 |
| merged_into_id | BIGINT | Y | (가공) | 중복 병합 시 살아남은 행. 값이 있으면 조회 제외 |
| synced_at | DATETIME | N | — | 적재 시각 |

인덱스:

```text
uk_place_source_source_key                            (source, sourceKey)   ← 원천이 둘이라 복합 UK
idx_place_content_id                                  (contentId)
idx_place_indoor_pet_available                        (indoor, petAvailable)
idx_place_merged_into_id                              (mergedIntoId)
idx_place_area_code_sigungu_code_content_type_id      (areaCode, sigunguCode, contentTypeId)
idx_place_content_type_id_pet_available               (contentTypeId, petAvailable)
idx_place_lat_lng                                     (lat, lng)          — 주변 검색용
idx_place_source_modified_at                          (sourceModifiedAt)  — 증분 동기화
```

## 2. place_intro — 타입별 소개 (1:1)

원천: `detailIntro2`. contentTypeId별 필드가 전부 달라서(실호출로 확인: 관광지는 usetime/restdate/parking/chkpet 등),
**공통 의미 컬럼만 정규화**하고 나머지는 원문 JSON으로 보관한다.

| 컬럼 | 타입 | Null | 원천 필드 (타입별 매핑) | 설명 |
|------|------|------|------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| place_id | BIGINT | N | — | FK: place.id (**UK**) |
| info_center | VARCHAR(200) | Y | infocenter / infocenterfood / infocenterlodging | 문의처 |
| use_time | VARCHAR(300) | Y | usetime / opentimefood / usetimeleports | 운영시간 |
| rest_date | VARCHAR(200) | Y | restdate / restdatefood / restdateleports | 휴무일 |
| parking | VARCHAR(300) | Y | parking / parkingfood / parkinglodging | 주차 |
| chk_pet | VARCHAR(200) | Y | chkpet | 애완동물 동반 가능 (12/14/28만 존재, 빈 값 많음 — 판단은 pet API 우선) |
| chk_baby_carriage | VARCHAR(100) | Y | chkbabycarriage | 유모차 대여 |
| chk_credit_card | VARCHAR(100) | Y | chkcreditcard / chkcreditcardfood | 카드 가능 |
| raw_json | JSON | Y | (detailIntro2 item 전체) | 타입별 전체 원문 (firstmenu, roomcount, checkintime 등) |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_place_intro_place_id (placeId)
```

## 3. place_pet_info — 반려동물 동반 정보 (1:1)

원천: `KorPetTourService2 detailPetTour2` — 실호출 확인 필드 9종. **전부 자유 텍스트**
(예: acmpyTypeCd="전구역 동반가능", acmpyPsblCpam="전 견종 동반 가능", acmpyNeedMtr="목줄 착용").
원문 보존 + 가공 컬럼 분리. 가공 파싱 규칙은 batch에서 관리한다.

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| place_id | BIGINT | N | — | FK: place.id (**UK**) |
| acmpy_type_cd | VARCHAR(100) | Y | acmpyTypeCd | 동반 유형 원문 ("전구역 동반가능", "부분 동반가능" 등) |
| acmpy_psbl_cpam | VARCHAR(300) | Y | acmpyPsblCpam | 동반 가능 동물 원문 ("전 견종", "10kg 미만" 등) |
| acmpy_need_mtr | VARCHAR(500) | Y | acmpyNeedMtr | 동반 시 필요사항 ("목줄 착용" 등) |
| etc_acmpy_info | TEXT | Y | etcAcmpyInfo | 기타 동반 정보 (개행 포함 장문) |
| rela_acdnt_risk_mtr | VARCHAR(500) | Y | relaAcdntRiskMtr | 사고 대비사항 |
| rela_frnsh_prdlst | VARCHAR(300) | Y | relaFrnshPrdlst | 비치 품목 |
| rela_poses_fclty | VARCHAR(300) | Y | relaPosesFclty | 부대시설 (운동장 등) |
| rela_purc_prdlst | VARCHAR(300) | Y | relaPurcPrdlst | 구매 가능 품목 |
| rela_rntl_prdlst | VARCHAR(300) | Y | relaRntlPrdlst | 대여 가능 품목 |
| allowance_scope | VARCHAR(20) | N | (acmpyTypeCd 가공) | enum `PetAllowanceScope`: FULL_AREA / PARTIAL / OUTDOOR_ONLY / UNKNOWN |
| allowed_pet_size | VARCHAR(20) | N | (acmpyPsblCpam 가공) | enum `AllowedPetSize`: ALL / SMALL_ONLY / SMALL_MEDIUM / UNKNOWN |
| leash_required | BOOLEAN | N | (acmpyNeedMtr 가공) | 목줄 필요 여부, default false |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_place_pet_info_place_id (placeId)
```

- 가공 성공 시 `place.pet_allowance_type`도 함께 갱신한다 (조회 필터는 place 단독으로 처리 가능하게).

## 4. place_image — 추가 이미지 (1:N)

원천: `detailImage2` — 실호출 확인 필드.

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| place_id | BIGINT | N | — | FK: place.id |
| origin_img_url | VARCHAR(300) | N | originimgurl | 원본 URL |
| small_image_url | VARCHAR(300) | Y | smallimageurl | 썸네일 URL |
| img_name | VARCHAR(200) | Y | imgname | 이미지명 |
| serial_num | VARCHAR(30) | N | serialnum | 원천 일련번호 |
| cpyrht_div_cd | VARCHAR(10) | Y | cpyrhtDivCd | 저작권 |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_place_image_place_id_serial_num (placeId, serialNum)
```

## 5. walk_route / walk_course — 두루누비 (1:N)

원천: `Durunubi routeList / courseList` — 실호출 확인 필드. 코스는 `routeIdx`로 길(테마)에 소속된다.

### walk_route (길/테마)

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| route_idx | VARCHAR(30) | N | routeIdx | 원천 길 ID (**UK**, 예: T_ROUTE_MNG0000000001) |
| theme_nm | VARCHAR(100) | N | themeNm | 길 이름 (예: 남파랑길) |
| line_msg | VARCHAR(300) | Y | linemsg | 노선 한줄 설명 |
| theme_descs | TEXT | Y | themedescs | 테마 설명 (HTML 원문) |
| brd_div | VARCHAR(10) | N | brdDiv | enum `WalkBrdDiv`: DNWW(걷기) / DNBW(자전거) |
| source_created_at / source_modified_at | DATETIME | Y | createdtime/modifiedtime | 원천 등록/수정일 |
| synced_at | DATETIME | N | — | 적재 시각 |

### walk_course (코스)

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| crs_idx | VARCHAR(30) | N | crsIdx | 원천 코스 ID (**UK**) |
| walk_route_id | BIGINT | Y | (routeIdx 매핑) | FK: walk_route.id |
| route_idx | VARCHAR(30) | Y | routeIdx | 원천 길 ID (매핑 실패 대비 원문 보존) |
| crs_kor_nm | VARCHAR(100) | N | crsKorNm | 코스명 |
| crs_dstnc_km | DECIMAL(6,1) | Y | crsDstnc | 거리(km) |
| crs_totl_rqrm_minute | INT | Y | crsTotlRqrmHour | 총 소요시간(**분** — 필드명과 달리 분 단위, 실측 330=5.5h) |
| crs_level | TINYINT | Y | crsLevel | 난이도 1~3 |
| crs_cycle | VARCHAR(20) | Y | crsCycle | 순환형/비순환형 (enum `CourseCycleType`) |
| crs_summary | TEXT | Y | crsSummary | 요약 (HTML `<br>` 포함) |
| crs_contents | TEXT | Y | crsContents | 상세 설명 |
| crs_tour_info | TEXT | Y | crsTourInfo | 주변 관광 정보 |
| traveler_info | TEXT | Y | travelerinfo | 교통/이용 안내 |
| sigun | VARCHAR(50) | Y | sigun | 시군 (예: "제주 제주시" — 제주 필터 키) |
| brd_div | VARCHAR(10) | N | brdDiv | 걷기/자전거 |
| gpx_path | VARCHAR(300) | Y | gpxpath | GPX 파일 URL (경로 좌표는 필요 시 다운로드·파싱) |
| source_created_at / source_modified_at | DATETIME | Y | createdtime/modifiedtime | 원천 등록/수정일 |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_walk_route_route_idx        (routeIdx)
uk_walk_course_crs_idx         (crsIdx)
idx_walk_course_sigun_brd_div  (sigun, brdDiv)
```

## 6. stat_spot — 통계용 관광지 매칭 허브

집중률·연관관광지 API는 contentid가 없고 **(지역코드 + 관광지명 + tAtsCd 해시)** 기반이다 (실호출 확인:
집중률은 tAtsNm만, 연관은 tAtsCd 32자 해시 + tAtsNm). 두 API의 관광지를 하나로 모으고 place와 이름 매칭한다.

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| area_cd | VARCHAR(2) | N | areaCd | 법정동 시도코드 (제주=**50** — 관광코드 39와 다름 주의) |
| signgu_cd | VARCHAR(5) | N | signguCd | 법정동 시군구코드 (제주시=50110, 서귀포시=50130) |
| tats_nm | VARCHAR(200) | N | tAtsNm | 관광지명 원문 |
| tats_cd | VARCHAR(32) | Y | tAtsCd | 연관 API의 해시 코드 (집중률-only 스팟은 null) |
| place_id | BIGINT | Y | (이름 매칭) | FK: place.id — 매칭 실패 시 null 허용 |
| match_type | VARCHAR(20) | N | (가공) | enum `SpotMatchType`: EXACT / NORMALIZED / MANUAL / UNMATCHED |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_stat_spot_area_cd_signgu_cd_tats_nm  (areaCd, signguCd, tatsNm)
idx_stat_spot_tats_cd                   (tatsCd)
idx_stat_spot_place_id                  (placeId)
```

- 매칭 규칙(공백/괄호 제거 정규화 → 완전일치 → 수동 보정)은 batch가 소유. UNMATCHED도 적재는 유지한다.

## 7. congestion_forecast — 관광지 집중률 (30일 rolling)

원천: `TatsCnctrRateService tatsCnctrRatedList` — **signguCd 필수** 파라미터 (실호출 확인).
조회일 기준 향후 30일 × 관광지별 1행. 매일 재적재하므로 upsert.

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| stat_spot_id | BIGINT | N | (areaCd+signguCd+tAtsNm 매핑) | FK: stat_spot.id |
| base_ymd | DATE | N | baseYmd | 예측 대상 일자 |
| cnctr_rate | DECIMAL(6,2) | N | cnctrRate | 집중률 (예: 30.11) |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_congestion_forecast_stat_spot_id_base_ymd (statSpotId, baseYmd)
```

## 8. related_place — 연관 관광지 (월 단위)

원천: `TarRlteTarService1 areaBasedList1` (오퍼레이션명 실호출 확인, baseYm 월 단위, rlteRank 순위).

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| base_ym | CHAR(6) | N | baseYm | 기준 연월 (예: 202506) |
| stat_spot_id | BIGINT | N | (tAtsCd 매핑) | FK: stat_spot.id — 중심 관광지 |
| rlte_tats_cd | VARCHAR(32) | N | rlteTatsCd | 연관 관광지 해시 코드 |
| rlte_tats_nm | VARCHAR(200) | N | rlteTatsNm | 연관 관광지명 |
| rlte_regn_cd | VARCHAR(2) | Y | rlteRegnCd | 연관 시도코드 |
| rlte_signgu_cd | VARCHAR(5) | Y | rlteSignguCd | 연관 시군구코드 |
| rlte_ctgry_lcls_nm | VARCHAR(50) | Y | rlteCtgryLclsNm | 카테고리 대 (관광지/음식/숙박) |
| rlte_ctgry_mcls_nm | VARCHAR(50) | Y | rlteCtgryMclsNm | 카테고리 중 |
| rlte_ctgry_scls_nm | VARCHAR(50) | Y | rlteCtgrySclsNm | 카테고리 소 |
| rlte_rank | SMALLINT | N | rlteRank | 연관 순위 (1~50) |
| rlte_spot_id | BIGINT | Y | (매칭) | FK: stat_spot.id — 연관 쪽 스팟 매칭 (nullable) |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_related_place_base_ym_stat_spot_id_rlte_tats_cd (baseYm, statSpotId, rlteTatsCd)
idx_related_place_stat_spot_id_rlte_rank           (statSpotId, rlteRank)
```

## 9. area_visitor_stat — 지역별 방문자수 (일 단위)

원천: `DataLabService metcoRegnVisitrDDList`(광역: areaCode 2자리) / `locgoRegnVisitrDDList`(기초: signguCode 5자리) —
실호출 확인. 두 레벨은 집계 기준이 달라 합산 금지(공식 명시) → `stat_level`로 분리 저장.

| 컬럼 | 타입 | Null | 원천 필드 | 설명 |
|------|------|------|-----------|------|
| id | BIGINT | N | — | PK (Snowflake) |
| stat_level | VARCHAR(10) | N | (오퍼레이션 구분) | enum `VisitorStatLevel`: METRO / LOCAL |
| region_code | VARCHAR(5) | N | areaCode / signguCode | 광역 2자리(제주=50) 또는 시군구 5자리(50110/50130) |
| region_nm | VARCHAR(50) | N | areaNm / signguNm | 지역명 |
| base_ymd | DATE | N | baseYmd | 기준 일자 |
| daywk_div_cd | TINYINT | N | daywkDivCd | 요일 구분 |
| tou_div_cd | TINYINT | N | touDivCd | enum `TouristDivType`: 1 현지인 / 2 외지인 / 3 외국인 |
| tou_num | DECIMAL(14,2) | N | touNum | 방문자 수 (소수점 포함 — 실측 "186126.5") |
| synced_at | DATETIME | N | — | 적재 시각 |

```text
uk_area_visitor_stat_stat_level_region_code_base_ymd_tou_div_cd (statLevel, regionCode, baseYmd, touDivCd)
```

- 지역 필터 파라미터가 없어 전국이 내려온다 → batch에서 제주(50, 50110, 50130)만 필터 적재.

## 10. 날씨 — Redis 격자별 캐시, 테이블은 선택 (구현 완료)

원천: `기상청 VilageFcstInfoService_2.0` — `getVilageFcst`(단기예보, category별 행: TMP/POP/PTY/SKY/REH/WSD/PCP/TMN/TMX...),
`getUltraSrtNcst`(초단기실황: T1H/RN1/REH/PTY/WSD...) 실호출 확인. 격자 좌표(nx,ny) 기반 (제주시 53/38, 서귀포 52/33).

- 적합도 계산용 실시간 조회는 **Redis 캐시**로 충분하며 구현되어 있다.
  키는 장소가 아니라 **격자(nx, ny)** 단위고, TTL 은 고정값이 아니라 **다음 발표 시각**에 맞춘다.
  신선도가 지난 뒤에도 스테일 폴백용으로 기본 6시간 남긴다 (`weather-insight-integration.md` §4).
- 성향 분석·이력이 필요해지면 그때 추가할 테이블 (category 행을 시각 단위로 피벗):

| 컬럼 | 타입 | 원천 | 설명 |
|------|------|------|------|
| id / nx / ny / fcst_at | — | fcstDate+fcstTime | 격자·예보시각, uk(nx, ny, fcstAt) |
| tmp, pop, pty, sky, reh, wsd, pcp | — | category별 fcstValue | 기온/강수확률/강수형태/하늘/습도/풍속/강수량 |
| base_at, synced_at | — | baseDate+baseTime | 발표 시각 |

## 11. 적재 전략 요약 (batch-service)

| 대상 | 오퍼레이션 | 주기 | upsert 키 | 비고 |
|------|-----------|------|-----------|------|
| place (초기) | KorService2 `areaBasedList2` (areaCode=39, 타입별) + 상세 3종 | 최초 1회 | content_id | 제주 관광지(12)=331건 확인. 전 타입 합산 후 상세 3콜/건 → **개발계정 1,000건/일 제한으로 며칠 분할** |
| place (증분) | `areaBasedSyncList2` (showflag) | 주 1회 | content_id | modifiedtime 기준 |
| pet 마킹 | KorPetTourService2 `areaBasedList2`(areaCode=39) + `detailPetTour2` | 주 1회 | place_id | 제주 관광지 타입 29건 확인 (전 타입 확인 필요) |
| walk_route/course | Durunubi `routeList`/`courseList` | 월 1회 | route_idx / crs_idx | sigun으로 제주 필터 |
| stat_spot + congestion | `tatsCnctrRatedList` (areaCd=50 × signguCd 50110/50130) | 일 1회 | spot+base_ymd | 서귀포만 4,284행(30일×143곳) 확인 |
| related_place | TarRlteTarService1 `areaBasedList1` (연월별) | 월 1회 | base_ym+spot+rlte_tats_cd | |
| area_visitor_stat | metco/locgo `RegnVisitrDDList` | 일 1회 (D-4~) | level+region+ymd+tou_div | 전국 응답 → 제주만 필터 |

## 12. JPA 엔티티 스켈레톤 예시 (place)

```java
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "place",
    indexes = {
        @Index(name = "uk_place_content_id", columnList = "contentId", unique = true),
        @Index(name = "idx_place_area_code_sigungu_code_content_type_id", columnList = "areaCode,sigunguCode,contentTypeId"),
        @Index(name = "idx_place_content_type_id_pet_available", columnList = "contentTypeId,petAvailable"),
        @Index(name = "idx_place_lat_lng", columnList = "lat,lng"),
        @Index(name = "idx_place_source_modified_at", columnList = "sourceModifiedAt")
    }
)
public class PlaceEntity extends BaseEntity {

    @Id
    @Comment("장소 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("TourAPI 콘텐츠 아이디")
    private Long contentId;

    @Column(nullable = false, length = 2)
    @Comment("콘텐츠 타입 (12 관광지, 32 숙박, 39 음식점 등)")
    private String contentTypeId;

    @Column(nullable = false, length = 200)
    @Comment("장소명")
    private String title;

    // ... (문서 §1 컬럼 정의대로)

    @Column(nullable = false)
    @Comment("반려동물 동반 콘텐츠 여부")
    private boolean petAvailable;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("반려동물 동반 구분 (가공값)")
    private PetAllowanceType petAllowanceType;
}
```

- ID 발급은 Processor에서 `SnowflakeIdGenerator` 사용 (`architecture-guide.md` §5).
- 도메인 모델은 primitive `long id`, 엔티티는 wrapper `Long` (`coding-conventions.md` §9-3).

## 13. Enum 정의 목록

| Enum | 값 | 사용처 |
|------|-----|--------|
| `ContentType` | TOURIST_SPOT(12), CULTURE(14), FESTIVAL(15), COURSE(25), LEPORTS(28), LODGING(32), SHOPPING(38), RESTAURANT(39) | place |
| `PetAllowanceType` | ALLOWED / PARTIALLY_ALLOWED / NOT_ALLOWED / UNKNOWN | place |
| `PetAllowanceScope` | FULL_AREA / PARTIAL / OUTDOOR_ONLY / UNKNOWN | place_pet_info |
| `AllowedPetSize` | ALL / SMALL_ONLY / SMALL_MEDIUM / UNKNOWN | place_pet_info |
| `WalkBrdDiv` | WALK(DNWW) / BIKE(DNBW) | walk_route, walk_course |
| `CourseCycleType` | CIRCULAR / NON_CIRCULAR | walk_course |
| `SpotMatchType` | EXACT / NORMALIZED / MANUAL / UNMATCHED | stat_spot |
| `TouristDivType` | LOCAL(1) / DOMESTIC_OTHER(2) / FOREIGN(3) | area_visitor_stat |
| `VisitorStatLevel` | METRO / LOCAL | area_visitor_stat |

전부 `coding-conventions.md` §11 metadata 규칙(displayName/description)을 따른다.
