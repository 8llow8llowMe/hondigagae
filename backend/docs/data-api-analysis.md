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
| 8 | 기상청_중기예보 조회서비스 | 마이페이지 | `1360000/MidFcstInfoService` |

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

#### 지역 필터는 `lDongRegnCd` 를 쓴다 (#726)

**`areaCode` 로 거르면 안 된다.** TourAPI 가 법정동 체계로 이관하면서 제주 콘텐츠 상당수의
`areacode` / `sigungucode` 를 **빈 문자열로 비웠다.** 비워진 콘텐츠는 `areaCode=39` 조회에
잡히지 않는데, 호출은 정상(`resultCode=0000`)이고 `totalCount` 도 그만큼만 내려오므로
**적재는 조용히 성공으로 끝난다.**

2026-09-18 실측 (`areaBasedList2` `totalCount`):

| contentTypeId | `areaCode=39` | `lDongRegnCd=50` | 누락 |
|---|---|---|---|
| 12 관광지 | 293 | 560 | 267 |
| 14 문화시설 | 33 | 98 | 65 |
| 15 축제·공연 | 5 | 25 | 20 |
| 25 여행코스 | 0 | 0 | 0 |
| 28 레포츠 | 35 | 137 | 102 |
| 32 숙박 | 54 | 210 | 156 |
| 38 쇼핑 | 21 | 395 | 374 |
| 39 음식점 | 439 | 699 | 260 |
| **합계** | **880** | **2,124** | **1,244 (58.6%)** |

원본 아이템 인용 (`contentid 1839477`): `"areacode": "", "sigungucode": "", "lDongRegnCd": "50", "lDongSignguCd": "130"`.

**여행코스(25)는 지역 키와 무관하게 0건이다** — `areaCode=39` 도 `lDongRegnCd=50` 도 `totalCount=0`.
원천에 제주 여행코스가 없는 것이지 필터가 어긋난 것이 아니다. 적재 대상
(`PlaceContentType.DEFAULT_IMPORT_TARGETS`)에는 25 가 들어 있으므로 **매 실행 0건이 정상**이고,
이 사실이 delist 범위 설계의 근거다 (`services/batch-service.md`, #726).

이관 시점의 공식 공지는 확인하지 못했다. 올레 콘텐츠의 `modifiedtime` 이 2026-09-09~11 에
몰려 있어 그 무렵 일괄 이관으로 보인다.

### contentTypeId

`12` 관광지 · `14` 문화시설 · `15` 축제공연행사 · `25` 여행코스 · `28` 레포츠 · `32` 숙박 · `38` 쇼핑 · `39` 음식점

### 목록 item 필드 (엔티티 후보)

| 필드 | 설명 | 비고 |
|------|------|------|
| `contentid` | 콘텐츠 ID | **원천 식별자 (UK)** |
| `contenttypeid` | 콘텐츠 타입 | enum |
| `title` | 명칭 | |
| `addr1`, `addr2` | 주소, 상세주소 | |
| `areacode`, `sigungucode` | 지역/시군구 코드 | 제주=39. **2026-09 이후 빈 값인 콘텐츠가 많다 (#726)** |
| `lDongRegnCd`, `lDongSignguCd` | 법정동 시도/시군구 코드 | KorService2 신규. **지역 필터는 이쪽을 쓴다 (#726)** |
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
- ~~GPX URL을 그대로 저장하고, 경로 좌표가 필요할 때 다운로드·파싱한다 (지도 표시용).~~
  **이 원천은 쓰지 않는다.** `gpxpath` 는 경로 좌표열을 주는 유일한 후보였지만 **제주 커버리지가
  0개**라 올레 코스에는 쓸 수 없다 (#382 · 아래 §9). 위 필드 표는 "왜 안 쓰는지"의 근거로만
  남긴다 — `walk_course` 구현은 CSV + TourAPI 레포츠(28) 기반이다 (`services/tour-service.md`).

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

**예보 범위가 유한하다는 점이 기능 설계를 갈랐다.** 실측하니 단기예보는 5일치가 오고,
중기예보를 이어 붙이면 약 11일이 된다. 그보다 먼 날짜 — 다음 달 여행을 계획하는 사용자에게는
예보가 아예 없으며, 이것이 예외 상황이 아니라 **기본 경로**다.
그래서 적합도에 `INSUFFICIENT` 등급을 두었다 (`weather-insight-integration.md` §6-1).
중기예보는 §6-2 로 연동을 마쳤다.

> 서귀포 52/33 은 문서에 적힌 기준점 값이고, 서귀포시청 좌표를 변환하면 53/33 이 나온다.
> 기준점을 어디로 잡느냐의 차이이며, 실제 조회는 고정값이 아니라 장소 좌표를 변환해 쓴다.
> 제주를 격자 하나로 볼 수 없다 — 제주시(53/38)와 성산일출봉(60/37)은 다른 격자다.

## 6-2. 기상청 중기예보 (MidFcstInfoService) — 실호출 검증됨

Base: `https://apis.data.go.kr/1360000/MidFcstInfoService` (**단기예보와 같은 인증키로 통한다**)

오퍼레이션이 둘이고 **예보구역 코드 체계도 서로 다르다.** 두 응답을 날짜로 조인해야 하루가 완성된다.

| 오퍼레이션 | 주는 것 | 제주 코드 (실측 검증) |
|---|---|---|
| `getMidLandFcst` | 날씨 문장, 강수확률 | `11G00000` (제주도 전체 한 구역) |
| `getMidTa` | 최고/최저기온 | `11G00201`(제주) / `11G00401`(서귀포) |

기온은 지점이 갈리는 것이 실제로 의미가 있다 — 같은 회차에서 최고기온이 **제주 32도 / 서귀포 31도** 로 달랐다.

파라미터는 `serviceKey`, `dataType=JSON`, `numOfRows`, `pageNo`, `regId`, **`tmFc=yyyyMMddHHmm`**.
단기예보의 `base_date` + `base_time` 두 파라미터와 달리 발표시각이 하나로 합쳐져 있다.

### 응답이 날짜별 행이 아니다 (실측)

**한 행에 일차가 필드명으로 박혀 온다.** `totalCount` 는 항상 1이다.

```json
{"regId":"11G00000",
 "rnSt4Am":60,"rnSt4Pm":60,"rnSt5Am":30,"rnSt5Pm":30,"rnSt6Am":30,"rnSt6Pm":30,
 "rnSt7Am":30,"rnSt7Pm":30,"rnSt8":30,"rnSt9":30,"rnSt10":30,
 "wf4Am":"흐리고 비","wf4Pm":"흐리고 비","wf5Am":"구름많음","wf5Pm":"구름많음",
 "wf8":"구름많음","wf9":"구름많음","wf10":"구름많음"}
```

- **7일차까지는 `Am`/`Pm` 로 갈리고 8일차부터는 접미사가 없다.** 어댑터가 양쪽 형태를 모두 시도한다
- `getMidTa` 는 `taMin4`/`taMax4` … `taMin10`/`taMax10`. 신뢰구간 필드(`taMin4Low`, `taMin4High`)가 함께 오는데 쓰지 않는다
- 날씨가 코드가 아니라 **문장**이다. 관측된 표기: `"맑음"`, `"구름많음"`, `"흐림"`, `"흐리고 비"`.
  하늘상태와 강수형태가 한 문장에 섞여 있어 둘을 따로 뽑아내야 한다

### 첫 일차가 회차마다 다르다 (실측)

| tmFc | 응답에 있는 일차 | 첫 예보일 |
|---|---|---|
| `202608261800` (어제 18시) | 5 ~ 10 | 8/31 |
| `202608270600` (오늘 06시) | 4 ~ 10 | 8/31 |

**일차 번호는 발표일 기준이라 회차마다 다르지만 실제 첫 예보일은 같다.** 그래서 어댑터는
넉넉히 3일차부터 훑고 없는 일차를 조용히 건너뛴다. 조회일이 아니라 **발표일**에서 세는 것이
중요하다 — 18시 회차를 다음 날 새벽에 조회할 때 조회일로 세면 하루가 밀린다.

### 커버리지 (실측)

| 원천 | 범위 | 비고 |
|---|---|---|
| 단기예보 | 오늘 ~ **오늘+4** (5일) | 문서의 "3일"보다 넓다 |
| 중기예보 | 오늘+4 ~ **오늘+10** (7일) | |
| 합계 | **오늘 ~ 오늘+10 (약 11일)** | 오늘+4 에서 겹치고 빈 날짜는 없다 |

### 단기예보 마지막 날은 자정 한 시각뿐이다 (실측)

`base_date=20260827&base_time=1400` 응답의 날짜별 시각 수다.

| 날짜 | 시각 수 | 범위 |
|---|---:|---|
| 8/27 (오늘) | 9 | 15:00 ~ 23:00 |
| 8/28 | 24 | 00:00 ~ 23:00 |
| 8/29 | 24 | 00:00 ~ 23:00 |
| 8/30 | 8 | 00:00 ~ 21:00 (3시간 간격) |
| **8/31** | **1** | **00:00 만** |

**이것이 조용한 버그를 만든다.** 8/31 을 하루로 접으면 최고기온이 자정 기온이 되어, 근거가
거의 없는데도 그럴듯한 점수가 나온다. 예외도 경고도 없다.

그래서 `DailyWeather.hasDaySummary` 로 온전함을 따지고, 온전하지 않은 날은 최고/최저기온을
원천에서 직접 주는 **중기예보를 쓴다**. 판정 기준은 낮 데이터의 존재다 — 최고기온은 오후에
나오므로 12시 이후 예보가 없으면 하루의 최고기온을 놓친다. 오늘은 예외로 남은 시각만 있어도
쓴다(지나간 시간이 없는 것이 정상이고, "남은 하루"는 그 자체로 답이 된다).

또 `TMN`/`TMX` 는 전체 798행 중 **3행씩만** 온다. 뒤쪽 날짜에는 최저/최고기온이 없어
시각별 기온으로 대신해야 한다.

### 그 밖의 실측값

- `resultCode` 는 `"00"` / `resultMsg` 는 `"NORMAL_SERVICE"` (관광공사 계열의 `"0000"` 과 다르다)
- 아직 발표되지 않은 회차를 물으면 `resultCode="03"`(NO_DATA)이 온다. 오류가 아니라 빈 결과다
- `WSD`(풍속)는 `"2.4"`, `"1.9"` 처럼 소수로 온다
- `PCP` 실측 값 전체: `강수없음`, `1mm 미만`, `0`, `1`, `2`, `1.0mm`, `2.0mm`, `3.0mm`, `4.0mm`, `11.0mm`, `12.0mm`
  — **맨숫자와 mm 표기가 섞여 온다.** 범위 표기(`30.0~50.0mm`)는 이 회차에 없었지만 방어해 둔다
- `SNO`(신적설)는 `적설없음` / `0`. 강수와 다른 문구를 쓴다

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

walk_course                    ※ 이 초안은 폐기됐다 (아래 주석 참조)
├─ crs_idx UK, route_idx, crs_kor_nm, crs_dstnc, crs_totl_rqrm_hour
├─ crs_level, crs_cycle, brd_div, sigun
├─ crs_summary, crs_contents, crs_tour_info, traveler_info, gpx_path
└─ source_created_at, source_modified_at, synced_at
```

> **`walk_course` 초안은 구현과 다르다 — 위 모양을 따라가지 말 것.** 두루누비를 원천으로 가정하고
> 그린 초안인데, 두루누비는 제주가 0개라 배제했다(§6 · §9). 실제 구현은 공공데이터포털 올레코스현황
> CSV + TourAPI 레포츠(28) 결합이고 컬럼은 `course_key` UK · `course_no` · `variant` ·
> `course_order` · `name` · `distance_km` · `duration_text` · `duration_max_minutes` ·
> `start_end_point` · `lat` · `lng` · `content_id` · `first_image` · `base_date` · `synced_at` 이다.
> **`gpx_path` 는 구현에 없다** — 경로 좌표열을 주는 원천이 없기 때문이다(§9). 정본은
> `WalkCourseEntity` 와 `services/tour-service.md` 다.

- 날씨(기상청)는 DB 적재 대신 **Redis 격자별 캐시**를 쓴다 (`weather-insight-integration.md` §4). 성향 분석용 이력이 필요해지면 그때 테이블 추가.
- 제주만 대상으로 하면 지역 필터로 적재량을 크게 줄일 수 있다 (개발계정 일 1,000건 제한 대응).
  **단 KorService2 에서는 `areaCode=39` 가 아니라 `lDongRegnCd=50` 을 쓴다 (#726)** — 원천이 `areacode` 를
  비우고 있어 `areaCode` 로 거르면 제주 콘텐츠의 58.6% 가 조용히 빠진다. 위 §2 "지역 필터는
  `lDongRegnCd` 를 쓴다 (#726)" 가 정본이고, 이 줄의 애초 판단(및 그 시절의 "약 964곳" 추정)은
  `areaCode` 기준이라 더는 맞지 않는다.

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
| 기상청 MidFcstInfoService | getMidLandFcst(11G00000), getMidTa(11G00201/11G00401) | 동일 키 사용 가능. 2026-08-27 재검증 |

- 서비스 키는 URL 인코딩해서 사용하고, **절대 커밋하지 않는다** (`.env` / 환경변수, 서비스에서는 `@ConfigurationProperties` + Jasypt).
- 코드 체계 정리: 관광 areaCode(제주=39, 시군구 3/4)는 KorService2·KorPetTourService2 전용, 법정동 코드(제주=50, 50110/50130)는 통계 3종·lDong 필드 공용.
  **단 KorService2 의 지역 *필터* 는 예외다 — `areaCode` 가 비워지고 있어 `lDongRegnCd` 로 건다 (#726, 위 §2 참고).**
  관광 areaCode 는 계속 **저장소 안의 적재 범위 키**(`place.area_code`, delist·병합·조회 필터)로 쓴다. 바깥으로 나가는 조회 키와 안에서 쓰는 범위 키가 다르다.
- 재검증이 필요하면 위 표의 호출 조합을 그대로 사용한다 (공통 파라미터: `MobileOS=ETC&MobileApp=hondigagae&_type=json`).
- **Durunubi 재검증 (2026-09-19, #736)**: `courseList` 가 140건이고 **제주 0건**이다. 2026-08-24 의
  142건에서 둘 줄었을 뿐 분포는 같다. 포털 소개문의 "284개"는 실응답과 다르니 근거로 쓰지 말 것.
  상세는 §9-1.

## 9. 올레 코스 경로 좌표열 원천 조사 (2026-09-19, #736) — **공개 원천에 없다**

**결론: 제주올레 코스의 경로 좌표열(폴리라인)을 주는 공개 원천은 없다. 운영 주체의 공식
사이트에도 없다.** 그래서 코스 상세에 경로 선을 그리는 지도는 세우지 않는다.

이 절은 다음 사람이 같은 조사를 반복하지 않게 하려고 남긴다. **"아직 안 찾아봤다"가 아니라
"찾아봤고 없다"** 이다. 새로 뒤지기 전에 아래 네 곳이 이미 닫혔다는 것부터 확인할 것.

### 9-1. 확인한 원천과 결과

| 원천 | 확인 방법 | 결과 |
|------|-----------|------|
| 한국관광공사 두루누비 (`gpxpath`) | **실호출** + 사이트 구조 | **제주 0건.** 코리아둘레길 전용 |
| 전국길관광정보표준데이터 (`coursInfo`) | 표준 출력 항목 명세 | **좌표 필드 자체가 없음.** 주소 + 텍스트 |
| 제주 공간정보포털 (`gis.jeju.go.kr`) | ArcGIS REST 서비스 전수 열거 | **항공사진·지오프로세싱뿐.** 올레 노선 레이어 없음 |
| 제주올레 공식 사이트 (`jejuolle.org`) | SPA 번들 전수 분석 | **시작점·종점 2점뿐.** 폴리라인 없음 |

**두루누비 — 재실호출 (2026-09-19)**

```
GET /B551011/Durunubi/courseList?numOfRows=1000&pageNo=1   → totalCount = 140
```

| 시도 | 코스 | 시도 | 코스 |
|------|------|------|------|
| 강원 | 35 | 전북 | 6 |
| 전남 | 28 | 부산 | 4 |
| 충남 | 16 | 울산 | 4 |
| 경북 | 16 | 인천 | 2 |
| 경기 | 15 | 서울 | 1 |
| 경남 | 13 | **제주** | **0** |

`sigun` 으로 집계했고 합계 140, **제주 0건 · 코스명에 "올레"를 포함하는 항목 0건**이다.
`gpxpath` 는 140건 **전부** 갖고 있다 — 즉 경로 좌표열을 주긴 하는데 **줄 제주 코스가 없다.**
`brdDiv=DNWW`(걷기) 필터를 걸어도 140으로 같다.

이 분포는 #382 이 2026-09-09 에 남긴 실측(커밋 `1f021e90` 의 "강원35·전남28…")과 **정확히
일치한다.** 그때는 142, 지금은 140이다.

**재확인이 필요했던 이유**: 포털 소개문이 "코리아둘레길의 **284개** 코스 상세 GPX"로 적혀 있어
(2026-02-25 수정) 제주가 편입됐는지 봐야 했다. **소개문의 284와 API 실응답 140은 다르다** —
소개문을 근거로 쓰지 말 것. 어느 쪽이든 제주는 0이다.

**건수보다 오래 가는 근거는 사이트 구조다.** 두루누비의 코스 목록 경로는
`haeparang-course-list.do` · `namparang-course-list.do` · `seohaerang-course-list.do` ·
`dmz-course-list.do` **넷뿐**이고, 이 넷이 곧 코리아둘레길(해파랑·남파랑·서해랑·DMZ평화의길)이다.
제주올레 목록 경로는 아예 없다. **데이터가 덜 들어온 것이 아니라 범위 밖이라, 다음에 코스가 더
늘어도 결론은 같다.**

**전국길관광정보표준데이터** (`https://api.data.go.kr/openapi/tn_pubr_public_stret_tursm_info_api`)
— 항목에 `coursInfo`(경로정보)가 있어 후보로 보이지만, 출력 항목 전체가
`stretNm · stretIntrcn · stretLt · reqreTime · beginSpotNm · beginRdnmadr · beginLnmadr ·
endSpotNm · endRdnmadr · coursInfo · phoneNumber · institutionNm` 로 **위경도 필드가 하나도 없다.**
시종점은 **주소**로 오고 `coursInfo` 는 지명을 잇는 **텍스트**다. 올레 CSV 의 `시종점정보`
(`시흥리정류장-광치기해변`)와 같은 종류이며, 지오코딩해도 2점이지 경로가 아니다.

**제주 공간정보포털** — `https://gis.jeju.go.kr/arcgis/rest/services` 가 열려 있어(ArcGIS 10.91,
인증 불필요) 폴더를 전수 열거했다. `jjuis`(147) · `jjuisWeb`(33)는 연도별 항공사진 타일,
`GPserver`(8)는 `ExportWebMap` 계열 지오프로세싱, `Hosted` · `JJGWIMS` 는 0건이다. **벡터 노선
레이어가 없다.**

**제주올레 공식 사이트** — 코스 상세 화면을 그리는 번들
(`/assets/Road-BJhBWDdi.js`, 420KB)에 코스별 좌표가 박혀 있는데 그 모양이
`{start:{lat,lng}, end:{lat,lng}}` 뿐이다. 29개 코스 × 2점 = **위도 출현 58개로 정확히 일치**하고,
`gpx` · `kml` · `geojson` · `polyline` · `setPath` · `LineString` 문자열이 **전부 0회**, 3점 이상
연속 좌표 배열도 **0개**다. 즉 **운영 주체조차 경로 선을 그리지 않는다.** 관련 서비스인
올레트립(`olletrip.com`)은 예약 사이트라 경로 데이터가 없고, 정적 호스트
(`contents.ollepass.org/static/homepage/trail/`)에도 사진만 있고 gpx/json 은 404 다.

### 9-2. 부산물 — 시작점·종점 좌표 29개 코스 전부 (#722 로 넘김)

경로는 못 찾았지만 **시작점·종점 좌표는 29개 코스 전부가 위 공식 사이트 번들에 있다.** 적재된
올레 코스 29개 중 좌표가 있는 것이 4개뿐인 #722 에 직접 쓰인다. 사이트 키(`03_A`)와 저장소
`courseKey`(`3-A`)는 앞자리 0 제거 + `_`→`-` 로 기계적으로 대응한다.

**쓰기 전 조건 둘.** ① 이미 좌표가 있는 4개(2 · 3(B) · 4 · 15(B))를 이 값과 **대조**해야 한다 —
독립적인 두 원천의 교차검증이고, 어긋나면 나머지 25개도 믿을 수 없다. ② 이 값은 **(사)제주올레라는
민간 법인의 사이트 자산이지 공공데이터가 아니다.** 1차 원천으로 승격하지 않고 TourAPI 매칭
실패분의 **보완**으로만 쓴다 (#722 에서 그렇게 정했다).

### 9-3. 다시 뒤진다면

- 위 네 곳은 닫혔다. **같은 곳을 다시 재지 말 것.**
- 남은 길은 원천을 새로 **만드는** 쪽이다 — (사)제주올레에 데이터 제휴를 문의하거나, GPS 트랙
  플랫폼(에브리트레일·komoot 등)의 사용자 업로드 트랙을 라이선스 확인 후 쓰는 것. 둘 다
  기술 문제가 아니라 협의·라이선스 문제다.
- **경로가 없다고 코스 상세가 못 서는 것은 아니다.** 시작점·종점 2점이 있으면 지도에 구간을
  표시할 수 있고, 골든타임 동선은 시작점 좌표만으로 이미 붙어 있다.

### 9-4. 그래서 무엇을 실었나 — 종점 좌표 24/29 · 경로 0 (2026-09-21, #816)

§9 의 결론(경로 좌표열 없음)을 받아 **두 점까지만** 싣기로 하고 적재를 고쳤다. `walk_course` 에
`start_point_name` · `end_point_name` · `end_lat` · `end_lng` 넷이 늘었고, 응답(목록·상세) 에도
그대로 나간다.

**새 원천을 붙이지 않았다.** 종점 좌표는 **인접 코스의 시작점**에서 끌어온다 — 올레는 한 코스의
종점이 다음 코스의 시작점이라(`1코스 종점 광치기해변` = `2코스 시작`), 이미 29개 전부 들어와
있는 TourAPI 시작점 좌표를 **지점명으로 되찾기만** 하면 된다
(`OlleCourseEndpointResolver`). 지오코딩도, (사)제주올레 사이트 스크래핑도 하지 않는다.

| 값 | 결과 | 근거 |
|----|------|------|
| 시작점 좌표 | **29 / 29** | TourAPI 레포츠(28) 매칭 (#722·#766) |
| 종점 좌표 | **24 / 29** | 인접 코스 체이닝 (#816) |
| 경로 좌표열 | **0 / 29** | 공개 원천 없음 (§9) |
| 이미지 크기 | **0 / 29** | 아래 |

**종점 좌표가 비는 다섯은 결함이 아니다.** 7 · 9 · 21 · 10-1 · 14-1코스이고, 종점
(`월평아왜낭목쉼터` · `화순금모래해수욕장` · `종달바당` · `가파치안센터` · `오설록녹차밭`)에서
**출발하는 코스가 없어** 끌어올 곳이 없다. 7코스는 아깝다 — 종점 `월평아왜낭목쉼터` 와 8코스
시작 `월평아왜낭목` 은 같은 들머리로 보이지만, 한쪽이 다른 쪽을 포함할 뿐인 관계를 부분일치로
접으면 "○○포구" 류가 줄줄이 엮인다. 접지 않아 비는 편을 택했다.

**표기 정규화는 공백만 지운다.** 원천이 같은 곳을 두 표기로 부르는 쌍이 둘이다 —
`제주민속촌주차장입구`(3코스 종점) / `제주민속촌주차장 입구`(4코스 시작),
`김녕서포구`(20코스 시작) / `김녕 서포구`(19코스 종점). 접지 않으면 같은 지점이 지도에 두 번
찍힌다. **이름 자체는 원문 그대로 내려보낸다** — 좌표만 같게 맞추고 부르는 이름을 고치지 않는다.

**전제를 코드가 스스로 검사한다.** 체이닝은 "TourAPI `mapx`/`mapy` = 코스 시작점" 을 믿는데,
그것이 코스 어딘가의 대표점이라면 같은 곳에서 출발하는 코스들(3-A·3-B, 15-A·15-B, 14·14-1)의
좌표가 벌어진다. 벌어지면(500m 초과) 그 지점명을 **통째로 버리고** WARN 을 남긴다 — 전제가
틀린 날 틀린 좌표가 나가지는 않는다.

**순환 코스 1-1(우도)은 시작점과 종점이 같은 값이다.** 두 점이 겹치는 것이 사실이고,
**두 점 사이 거리가 0 이라고 코스 길이가 0 인 것이 아니다**(11.3km). 화면이 두 점만 보고 길이를
재면 안 된다.

**이미지 width/height 는 원천에 없다.** TourAPI `searchKeyword2` 항목이 주는 이미지 필드는
`firstimage` · `firstimage2`(URL) 뿐이고 크기·비율 필드가 없다. 이미지를 직접 받아 헤더에서
크기를 읽는 것은 가능하지만, 목록 레이아웃이 튀는 문제는 화면이 고정 비율 상자로 푸는 편이
싸고 확실하다 — 대표이미지 CDN 에 적재 배치를 매 실행 29회 더 묶을 값어치가 없다고 보고
싣지 않았다. 필요해지면 별건으로 연다.

**경로 좌표열을 다시 찾아 나서기 전에 §9-3 을 읽을 것.** 네 곳은 닫혀 있다.

## 10. 제주올레 파일 다운로드 경로 (2026-09-23, #876) — 실호출 검증됨

공공데이터포털 파일데이터(`/data/15043496/fileData.do`)의 "다운로드" 버튼이 무엇을 부르는지
**페이지 스크립트를 읽고 같은 요청을 직접 보내** 확정했다. 추측으로 만든 URL 이 아니다.

### 10-1. 근거 — 버튼이 부르는 스크립트

| 단계 | 정의 위치 | 하는 일 |
|------|-----------|---------|
| `fileDetailObj.fn_fileDataDown(publicDataPk, publicDataDetailPk, atchFileId, fileDetailSn, publicDataHistSn)` | `/js/biz/datset/script_fileDetail.js` | `fn_cmmnAjax` 로 **`POST /tcs/dss/selectFileDataDownload.do`** (form: 네 인자 + `publicDataTyCode=PR0051`) |
| `fn_fileDataDownCb(data)` | 같은 파일 | 응답 JSON 의 `status` 가 true 면 `fn_fileDataDownload(atchFileId, fileDetailSn, dataNm)` |
| `fn_fileDataDownload` | `/js/biz/cmm/cmm/script_cmmFunction.js` | `POST /cmm/cmm/check-limit.json` → `needCaptcha=false` 면 **`/cmm/cmm/fileDownload.do?atchFileId=…&fileDetailSn=…`** |

페이지에 박힌 버튼 인자(09-23): `fn_fileDataDown('15043496', 'uddi:5e0b77df-759d-4378-a74f-bd393051521b', '','1', '1')`
— 세 번째 `atchFileId` 는 **빈 값**이고, 실제 파일 식별자는 티켓 응답에서 받는다.

### 10-2. 실측 응답 (로그인·인증키 없음)

| 요청 | 응답 |
|------|------|
| `POST /tcs/dss/selectFileDataDownload.do` | 200, `Content-Type: text/html;charset=UTF-8` 인데 **본문은 JSON**. 최상위 `status=true` · `atchFileId="FILE_000000007665534"` · `fileDetailSn="1"` + `dataSetFileDetailInfo`(`dataNm="제주특별자치도_올레코스현황_20260731"`, `updtDt="2026-09-10 14:47:34"`) |
| `POST /cmm/cmm/check-limit.json` | `{"needCaptcha":false}` |
| `GET /cmm/cmm/fileDownload.do?atchFileId=FILE_000000007665534&fileDetailSn=1` | 200, `application/octet-stream`, `Content-Length: 2259`, `Content-Disposition: attachment; filename="…_20260731.csv"`(파일명은 UTF-8 바이트를 ISO-8859-1 로 실은 것), 본문 **CP949** CSV — 첫 줄 `코스별,코스명,거리,소요시간정보,시종점정보,데이터기준일자` |

픽스처: `batch-service/src/test/resources/walkcourseimport/datagokr-olle-page-20260923.html`(페이지에서
필요한 부분만), `datagokr-olle-download-ticket-20260923.json`(티켓 응답 최상위 + 상세 일부).

### 10-3. 같은 페이지의 JSON-LD 는 왜 안 쓰나

09-23 페이지에도 `<script type="application/ld+json">` 이 있고 `DataDownload.contentUrl`
(`…fileDownload.do?atchFileId=FILE_000000007665534&fileDetailSn=1&insertDataPrcus=N`)도 들어 있다.
그런데 **블록이 JSON 으로 읽히지 않는다** — `description` 값이 `""제주특별자치도 내 …"<br/>"` 처럼
따옴표를 이스케이프하지 않고 원문을 그대로 넣었다. 제공기관이 설명 문구를 고칠 때마다 되살아났다
끊겼다 할 경로라 기준으로 삼지 않는다. 09-21 실측에서는 블록 자체가 0개였다(`data-refresh-guide.md` §5).

`atchFileId` 는 두 경로가 **같은 값**을 준다. 그래서 스냅샷 비교 키(`atchFileId` + 바이트 수)를 그대로 둔다.
