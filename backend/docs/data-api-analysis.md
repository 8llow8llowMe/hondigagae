# 공공데이터 API 분석 (엔티티 설계 기초)

> 목적: 공공데이터포털에서 신청한 API들의 응답 구조를 정리하고, 이를 기반으로 DB 엔티티를 설계하기 위한 기초 문서.
> **2026-08-24 승인 키로 7개 API 전부 실호출 검증 완료** — 아래 필드 표는 실제 응답 기준이다.
> 엔티티 설계 결과는 [entity-design.md](entity-design.md) 참고.

## 1. 신청 현황 (전부 승인 완료)

| # | API | data.go.kr | 실검증 엔드포인트 |
|---|-----|-----------|------|
| 1 | 국문 관광정보 서비스_GW | [15101578](https://www.data.go.kr/data/15101578/openapi.do) | `B551011/KorService2` |
| 2 | 반려동물_동반여행_서비스 | 마이페이지 | `B551011/KorPetTourService2` (오퍼레이션도 `*2`) |
| 3 | 관광지 집중률 방문자 추이 예측 | [15128555](https://www.data.go.kr/data/15128555/openapi.do) | `B551011/TatsCnctrRateService` |
| 4 | 빅데이터_지역별 방문자수_GW | [15101972](https://www.data.go.kr/data/15101972/openapi.do) | `B551011/DataLabService` |
| 5 | 관광지별 연관 관광지 정보 | [15128560](https://www.data.go.kr/data/15128560/openapi.do) | `B551011/TarRlteTarService1` |
| 6 | 두루누비 정보 서비스_GW | [15101974](https://www.data.go.kr/data/15101974/openapi.do) | `B551011/Durunubi` |
| 7 | 기상청_단기예보 조회서비스 | [15084084](https://www.data.go.kr/data/15084084/openapi.do) | `1360000/VilageFcstInfoService_2.0` |

### 남은 데이터 소스 (Open API 아님)

| 데이터 | 방식 | 용도 |
|-----|-----|------------|
| 제주 동물병원 현황 (지자체 파일데이터) | 파일 다운로드 → batch 적재 | 긴급 상황 도우미(24시 동물병원) |

- 모든 B551011(관광공사) API 개발계정은 **일 1,000건 제한** → batch 적재 전략 필수 (`external-api-guide.md` §2).
- 트래픽 증설은 운영계정 전환(활용사례 등록) 후 신청.
- **주의**: KorService1은 폐기 공지됨 — 반드시 `KorService2` 엔드포인트를 사용한다.

## 2. 공통 응답 래퍼 (B551011 계열 공통)

```json
{
  "response": {
    "header": { "resultCode": "0000", "resultMsg": "OK" },
    "body": {
      "items": { "item": [ { ... } ] },
      "numOfRows": 10,
      "pageNo": 1,
      "totalCount": 1234
    }
  }
}
```

- 공통 요청 파라미터: `serviceKey`, `MobileOS=ETC`, `MobileApp=hondigagae`, `_type=json`, `pageNo`, `numOfRows`
- `resultCode != "0000"`이면 오류. adapter에서 header를 먼저 검사한다.
- **함정 (실측)**: 파라미터 오류 시 위 래퍼가 아니라 **flat JSON**이 온다:
  `{"responseTime":"...","resultCode":"11","resultMsg":"NO_MANDATORY_REQUEST_PARAMETERS_ERROR1(signguCd)"}`
  — 역직렬화 실패 대비, 응답을 먼저 raw로 받아 형태 분기할 것.
- **함정 (실측)**: 결과 0건이면 `items`가 객체가 아니라 빈 문자열(`""`)로 온다 (detailPetTour2에서 확인).
- **함정 (실측)**: `mapx`=경도(lng), `mapy`=위도(lat). 순서 주의.
- **함정**: 잘못된 서비스/오퍼레이션 경로는 HTTP 400 + `OpenAPI_ServiceResponse` XML 스타일 오류가 온다.

## 3. 국문 관광정보 서비스_GW (KorService2)

Base: `https://apis.data.go.kr/B551011/KorService2`

### 오퍼레이션

| 구분 | 오퍼레이션 | 용도 |
|------|-----------|------|
| 코드 | `areaCode2`, `ldongCode2`, `categoryCode2`, `lclsSystmCode2` | 지역/법정동/카테고리/분류체계 코드 |
| 목록 | `areaBasedList2` | 지역 기반 목록 (적재 기본) |
| 목록 | `locationBasedList2` | 좌표+반경 기반 (+`dist` 필드) |
| 목록 | `searchKeyword2`, `searchFestival2`, `searchStay2` | 키워드/축제/숙박 검색 |
| 동기화 | `areaBasedSyncList2` | 신규/수정/삭제 포함 (`showflag`) — **주기 배치는 이걸 사용** |
| 상세 | `detailCommon2` | 공통 상세 (overview, homepage 포함) |
| 상세 | `detailIntro2` | 타입별 소개 (운영시간, 주차, **chkpet** 등) |
| 상세 | `detailInfo2` | 반복 상세 (객실 정보 등) |
| 상세 | `detailImage2` | 추가 이미지 |

### 주요 요청 파라미터 (areaBasedList2 기준)

`areaCode`(제주=39), `sigunguCode`, `contentTypeId`, `cat1~3`, `lclsSystm1~3`, `lDongRegnCd`, `lDongSignguCd`, `modifiedtime`, `arrange`(정렬: O제목/Q수정일/R생성일, 대표이미지 있는 것만: A/C/D)

### contentTypeId

`12` 관광지 · `14` 문화시설 · `15` 축제공연행사 · `25` 여행코스 · `28` 레포츠 · `32` 숙박 · `38` 쇼핑 · `39` 음식점

### 목록 item 필드 (엔티티 후보)

| 필드 | 설명 | 비고 |
|------|------|------|
| `contentid` | 콘텐츠 ID | **원천 식별자 (UK)** |
| `contenttypeid` | 콘텐츠 타입 | enum |
| `title` | 명칭 | |
| `addr1`, `addr2` | 주소, 상세주소 | |
| `areacode`, `sigungucode` | 지역/시군구 코드 | 제주=39 |
| `lDongRegnCd`, `lDongSignguCd` | 법정동 시도/시군구 코드 | KorService2 신규 |
| `cat1`, `cat2`, `cat3` | 카테고리 대/중/소 | |
| `lclsSystm1~3` | 신규 분류체계 대/중/소 | KorService2 신규 |
| `mapx`, `mapy` | **경도, 위도** | 순서 주의 |
| `mlevel` | 지도 레벨 | |
| `firstimage`, `firstimage2` | 대표 이미지 원본/썸네일 | |
| `cpyrhtDivCd` | 저작권 유형 (Type1/Type3) | 출처표기 의무 |
| `tel` | 전화번호 | |
| `createdtime`, `modifiedtime` | 원천 등록/수정일 (`yyyyMMddHHmmss`) | 증분 동기화 기준 |

### detailCommon2 추가 필드

`homepage`(HTML 포함), `overview`(개요), `zipcode`, `telname`

### detailIntro2 — 타입별 상이 (여행 적합도·필터에 중요)

- **관광지(12)**: `usetime`, `restdate`, `parking`, `infocenter`, `expguide`, `accomcount`, **`chkpet`(애완동물 동반 가능 여부 텍스트)**, `chkbabycarriage`, `chkcreditcard`, `useseason`
- **음식점(39)**: `firstmenu`, `treatmenu`, `opentimefood`, `restdatefood`, `parkingfood`, `reservationfood`, `infocenterfood`, `kidsfacility`
- **숙박(32)**: `roomcount`, `checkintime`, `checkouttime`, `parkinglodging`, `subfacility`, `reservationlodging`, `barbecue`, `sauna` 등
- **레포츠(28)**: `openperiod`, `usetimeleports`, `restdateleports`, `parkingleports`, `expagerangeleports` 등

→ 타입별 필드가 전부 달라서, 공통으로 쓸 항목(운영시간/휴무/주차/문의처/반려동물)만 정규 컬럼으로 뽑고 나머지는 raw JSON 보관을 권장 (§7).

### detailImage2

`originimgurl`, `smallimageurl`, `imgname`, `serialnum`, `cpyrhtDivCd`

## 4. 반려동물 동반여행 서비스 (KorPetTourService2) — 실호출 검증됨

Base: `https://apis.data.go.kr/B551011/KorPetTourService2` (**`KorPetTourService`(무접미)는 400 — 반드시 `2`**)

- 오퍼레이션: `areaBasedList2`(목록 — KorService2와 동일 필드 구성), `detailPetTour2`(동반 정보 상세), `petTourSyncList2`(동기화 목록, `showflag` 포함 — 전체 10,152건 확인)
- `contentid`가 국문 관광정보와 **동일 체계** (실측: 제주 관광지 타입 29건, 국문 관광정보의 contentid와 일치) → 장소 마스터에 그대로 결합 가능.
- 반려동물 동반 정보가 없는 contentid로 `detailPetTour2` 호출 시 `items=""`(0건) 반환.

### detailPetTour2 — 반려동물 동반 정보 필드 (실측 예시: 가세오름 1887866)

| 필드 | 설명 | 실측 값 |
|------|------|------|
| `acmpyTypeCd` | 동반 유형 | "전구역 동반가능" |
| `acmpyPsblCpam` | 동반 가능 동물 | "전 견종 동반 가능" |
| `acmpyNeedMtr` | 동반 시 필요사항 | "목줄 착용" |
| `etcAcmpyInfo` | 기타 동반 정보 | "- 길이 협소한 편으로... - 맹견의 경우, 입마개 착용 필수..." (개행 포함 장문) |
| `relaAcdntRiskMtr` | 사고 대비사항 | "" |
| `relaFrnshPrdlst` | 비치 품목 | "" |
| `relaPosesFclty` | 소유 부대시설 | "" |
| `relaPurcPrdlst` | 구매 가능 품목 | "" |
| `relaRntlPrdlst` | 대여 가능 품목 | "" |

→ 전부 **자유 텍스트 확정** (코드값 아님). 필터/추천에 쓰려면 적재 시 가공 enum(`PetAllowanceType` 등)으로 정규화하는 파싱 단계가 필요하다. 원문은 보존하고 가공 컬럼을 별도로 둔다 (`entity-design.md` §3).

## 5. 통계·예측 API (관광지명/지역코드 기반 — contentId 없음 주의)

### 5-1. 관광지 집중률 (TatsCnctrRateService) — 실호출 검증됨

Base: `https://apis.data.go.kr/B551011/TatsCnctrRateService` — 오퍼레이션 `tatsCnctrRatedList`

- 조회일 기준 **향후 30일** 관광지별 방문자 집중률 예측 (2018년~ 데이터 기반 ML)
- 요청: `areaCd` + **`signguCd`(필수 — 누락 시 NO_MANDATORY 오류 실측)**, `tAtsNm`(선택)
- **지역 코드는 법정동 코드 체계** (실측: 제주=50, 서귀포시=50130 — 관광 areaCode 39 아님)
- item (실측): `baseYmd`, `areaCd`/`areaNm`, `signguCd`/`signguNm`, `tAtsNm`, `cnctrRate`("30.11" 소수 문자열)
- 실측 규모: 서귀포시(50130) totalCount 4,284 = 관광지 약 143곳 × 30일

### 5-2. 지역별 방문자수 (DataLabService) — 실호출 검증됨

Base: `https://apis.data.go.kr/B551011/DataLabService`

- `metcoRegnVisitrDDList` (광역) / `locgoRegnVisitrDDList` (기초) — KT(내국인)/SKT(외국인) 이동통신 기반 일별 방문자
- 요청: `startYmd`, `endYmd` — **지역 필터 파라미터 없음 (전국 응답)** → batch에서 제주만 필터
- item (실측): 광역=`areaCode`(2자리)/`areaNm`, 기초=`signguCode`(5자리)/`signguNm` (**기초 응답에 areaCode 없음**), 공통=`daywkDivCd`/`daywkDivNm`(요일), `touDivCd`/`touDivNm`(1 현지인/2 외지인/3 외국인), `touNum`(**소수점 문자열** — "186126.5"), `baseYmd`
- 주의: 광역/기초 집계 기준이 달라 **합산 불가** (공식 명시). 데이터는 며칠 지연 후 제공.

### 5-3. 연관 관광지 (TarRlteTarService1) — 실호출 검증됨

Base: `https://apis.data.go.kr/B551011/TarRlteTarService1` — 오퍼레이션 `areaBasedList1` (**서비스명 `TarRlteTarService1`, 무접미/`2`는 400**)

- Tmap 내비 데이터 기반, 월 단위(`baseYm`), 지자체별 연관 방문 상위 관광지
- 요청: `baseYm`, `areaCd`, `signguCd` (법정동 코드 체계: 제주=50)
- item (실측): `baseYm`, 중심(`tAtsCd`, `tAtsNm`, `areaCd`/`areaNm`, `signguCd`/`signguNm`), 연관(`rlteTatsCd`, `rlteTatsNm`, `rlteRegnCd`/`rlteRegnNm`, `rlteSignguCd`/`rlteSignguNm`, `rlteCtgryLclsNm`/`rlteCtgryMclsNm`/`rlteCtgrySclsNm`, `rlteRank`)
- **중요 발견**: `tAtsCd`/`rlteTatsCd`라는 32자 해시 코드가 존재 (예: "dedafb051f866358...") — 명칭보다 안정적인 매칭 키
- 실측: 제주 서귀포시 202506 totalCount 4,642

### ⚠ 공통 제약: 통계 3종(집중률·방문자수·연관)은 `contentid`가 없다

- 집중률: (areaCd, signguCd, tAtsNm)만 제공 / 연관: + tAtsCd 해시 제공
- → 장소 마스터와 조인하려면 **매칭 허브 테이블**(`stat_spot`)이 필요하다. (지역코드 + 정규화 명칭)으로 place와 매칭하고, 실패 건은 UNMATCHED로 남겨 수동 보정한다 (`entity-design.md` §6).

## 6. 두루누비 (Durunubi) — 실호출 검증됨

Base: `https://apis.data.go.kr/B551011/Durunubi`

- `courseList` (코스, 실측): `crsIdx`(코스 ID, "T_CRS_MNG0000005118"), `routeIdx`(소속 길 ID), `crsKorNm`(코스명), `crsDstnc`(거리 km, "14"), `crsTotlRqrmHour`(**분 단위** — 실측 "330"=5.5시간), `crsLevel`(난이도, "2"), `crsCycle`("순환형"/"비순환형" 텍스트), `crsContents`/`crsSummary`(HTML `<br>` 포함), `crsTourInfo`(주변 관광), `travelerinfo`(교통), `sigun`("부산 서구" 형식 — 제주 필터 키), `brdDiv`("DNWW" 걷기/"DNBW" 자전거), `gpxpath`(GPX URL), `createdtime`, `modifiedtime`
- `routeList` (길, 실측): `routeIdx`, `themeNm`("남파랑길"), `linemsg`(한줄 설명), `themedescs`(HTML 원문), `brdDiv`, `createdtime`, `modifiedtime`
- GPX URL을 그대로 저장하고, 경로 좌표가 필요할 때 다운로드·파싱한다 (지도 표시용).

## 6-1. 기상청 단기예보 (VilageFcstInfoService_2.0) — 실호출 검증됨

Base: `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0` (같은 인증키 사용 가능 확인)

- `getVilageFcst` (단기예보, 실측): item = `baseDate`/`baseTime`(발표), `category`, `fcstDate`/`fcstTime`(예보 대상), `fcstValue`, `nx`/`ny`
  — **category별 1행** 구조: TMP(기온), POP(강수확률), PTY(강수형태), SKY(하늘), REH(습도), WSD(풍속), PCP(강수량), TMN/TMX(최저/최고), UUU/VVV/VEC(바람 성분)
- `getUltraSrtNcst` (초단기실황, 실측): `obsrValue` — T1H(기온), RN1(강수), REH, PTY, WSD 등
- 격자 좌표: 제주시 nx=53, ny=38 (실측 성공) / 서귀포시 nx=52, ny=33
- 발표 주기: 단기예보 1일 8회(02,05,08,11,14,17,20,23시), 초단기실황 매시 40분경
- 사용 방식: Redis 캐시 우선 (`external-api-guide.md` §2), 적합도 계산 입력

#### 연동 시 밟는 지점 (구현하며 드러난 것)

| 함정 | 내용 | 방어 |
|------|------|------|
| **위경도를 받지 않는다** | 5km 격자 번호(nx, ny)만 받는다. DFS 격자 변환이 필수다 | `common-core` 의 `KmaGrid` |
| **category 별 1행** | 같은 시각의 기온/강수확률/하늘상태가 서로 다른 행에 흔어져 온다 | 어댑터에서 시각 기준 피봇 |
| **PCP/SNO 는 문자열** | `강수없음`, `1mm 미만`, `30.0~50.0mm` 가 섞여 온다. `parseDouble` 하면 터진다 | `PrecipitationAmount` |
| **발표 회차 공백** | 회차 직후 몇 분은 데이터가 아직 없어 빈 응답이 온다 | 직전 회차로 한 단계 폴백 |
| **키 오류는 XML** | serviceKey 문제일 때 JSON 이 아니라 `OpenAPI_ServiceResponse` XML | 파싱 전 형태 확인 |
| **resultCode 가 다르다** | 기상청은 `"00"`, 관광공사 계열은 `"0000"` | 둘 다 수용 |

**예보 범위가 약 3일이라는 점이 기능 설계를 갈랐다.** 다음 달 여행을 계획하는 사용자에게는
예보가 아예 없으며, 이것이 예외 상황이 아니라 **기본 경로**다.
그래서 적합도에 `INSUFFICIENT` 등급을 두었다 (`weather-insight-integration.md` §6-1).
중기예보(`MidFcstInfoService`, 3~10일)는 아직 붙이지 않았다.

> 서귀포 52/33 은 문서에 적힌 기준점 값이고, 서귀포시청 좌표를 변환하면 53/33 이 나온다.
> 기준점을 어디로 잡느냐의 차이이며, 실제 조회는 고정값이 아니라 장소 좌표를 변환해 쓴다.
> 제주를 격자 하나로 볼 수 없다 — 제주시(53/38)와 성산일출봉(60/37)은 다른 격자다.

## 7. 엔티티 설계 초안 (tour-service / batch-service)

컨벤션: raw FK만 사용, 인덱스 명명 규칙, `@Comment` (`coding-conventions.md` §9). 내부 PK는 Snowflake, 원천 식별자는 UK.

```text
place                          장소 마스터 (KorService2 + 반려동물 API 공통 대상)
├─ id                 PK
├─ content_id         UK  ← contentid
├─ content_type_id        ← contenttypeid (enum)
├─ title, addr1, addr2, zipcode
├─ area_code, sigungu_code, ldong_regn_cd, ldong_signgu_cd
├─ cat1~3, lcls_systm1~3
├─ lat ← mapy, lng ← mapx        (변환해서 저장, 이름으로 혼동 차단)
├─ first_image, first_image2, cpyrht_div_cd
├─ tel, overview, homepage
├─ pet_allowance_type            (가공 enum: ALLOWED/PARTIALLY/NOT_ALLOWED/UNKNOWN)
├─ source_created_at, source_modified_at   ← createdtime/modifiedtime
└─ synced_at
   idx: uk_place_content_id / idx_place_area_code_sigungu_code_content_type_id / (lat,lng 공간 조회)

place_pet_info                 detailPetTour 원문 (1:1, place_id FK)
├─ acmpy_psbl_cpam, acmpy_type_cd, acmpy_need_mtr, etc_acmpy_info
├─ rela_acdnt_risk_mtr, rela_frnsh_prdlst, rela_poses_fclty
├─ rela_purc_prdlst, rela_rntl_prdlst
└─ synced_at

place_intro                    detailIntro2 (1:1, place_id FK)
├─ use_time, rest_date, parking, info_center, chk_pet   (타입 공통 추출 컬럼)
└─ raw_json                    (타입별 전체 원문 — JSON 컬럼)

place_image                    detailImage2 (1:N, place_id FK)
└─ origin_img_url, small_image_url, img_name, serial_num, cpyrht_div_cd

place_name_link                통계 API(명칭 기반) ↔ place 매칭
├─ source_type (CONGESTION / RELATED_PLACE)
├─ area_cd, signgu_cd, tats_nm (원천 명칭)
├─ place_id (nullable — 매칭 실패 허용)
└─ match_type (EXACT / NORMALIZED / MANUAL / UNMATCHED)

related_place                  연관 관광지 (TarRlteTarService)
├─ base_ym, area_cd, signgu_cd, tats_nm          (중심 관광지)
├─ rlte_tats_nm, rlte_regn_cd, rlte_signgu_cd
├─ rlte_ctgry_lcls_nm, rlte_ctgry_mcls_nm, rlte_ctgry_scls_nm
└─ rlte_rank
   uk: (base_ym, area_cd, signgu_cd, tats_nm, rlte_tats_nm)

congestion_forecast            집중률 (TatsCnctrRateService, 30일 rolling)
├─ base_ymd, area_cd, signgu_cd, tats_nm, cnctr_rate
└─ synced_at
   uk: (base_ymd, area_cd, signgu_cd, tats_nm) — 재적재는 upsert

area_visitor_stat              지역별 방문자수 (DataLabService)
├─ base_ymd, area_code, signgu_code(nullable=광역), tou_div_cd, tou_num
└─ uk: (base_ymd, area_code, signgu_code, tou_div_cd)

walk_course                    두루누비 코스
├─ crs_idx UK, route_idx, crs_kor_nm, crs_dstnc, crs_totl_rqrm_hour
├─ crs_level, crs_cycle, brd_div, sigun
├─ crs_summary, crs_contents, crs_tour_info, traveler_info, gpx_path
└─ source_created_at, source_modified_at, synced_at
```

- 날씨(기상청)는 DB 적재 대신 **Redis 격자별 캐시**를 쓴다 (`weather-insight-integration.md` §4). 성향 분석용 이력이 필요해지면 그때 테이블 추가.
- 제주만 대상으로 하면 areaCode=39 필터로 적재량을 크게 줄일 수 있다 (개발계정 일 1,000건 제한 대응).

## 8. 실호출 검증 결과 (2026-08-24 완료)

승인 키로 7개 API 전부 호출해 실제 응답을 확인했고, 이 문서의 필드 표를 실측 기준으로 갱신했다.

| API | 검증 호출 | 결과 |
|-----|----------|------|
| KorService2 | areaBasedList2(제주 관광지 331건), detailCommon2/detailIntro2/detailImage2 (천지연폭포 126439) | 전 필드 확인 |
| KorPetTourService2 | areaBasedList2(제주 관광지 타입 29건), detailPetTour2(가세오름), petTourSyncList2(전체 10,152건) | 서비스명 `2` 필수 확인 |
| TatsCnctrRateService | tatsCnctrRatedList(서귀포 50130, 4,284건) | signguCd 필수, 법정동 코드 체계 확인 |
| DataLabService | metco/locgoRegnVisitrDDList | 기초 응답에 areaCode 없음, touNum 소수 확인 |
| TarRlteTarService1 | areaBasedList1(서귀포 202506, 4,642건) | tAtsCd 해시 코드 발견 |
| Durunubi | courseList(142건), routeList | 전 필드 확인 |
| 기상청 VilageFcstInfoService_2.0 | getVilageFcst, getUltraSrtNcst (제주시 53/38) | 동일 키 사용 가능 확인 |

- 서비스 키는 URL 인코딩해서 사용하고, **절대 커밋하지 않는다** (`.env` / 환경변수, 서비스에서는 `@ConfigurationProperties` + Jasypt).
- 코드 체계 정리: 관광 areaCode(제주=39, 시군구 3/4)는 KorService2·KorPetTourService2 전용, 법정동 코드(제주=50, 50110/50130)는 통계 3종·lDong 필드 공용.
- 재검증이 필요하면 위 표의 호출 조합을 그대로 사용한다 (공통 파라미터: `MobileOS=ETC&MobileApp=hondigagae&_type=json`).
