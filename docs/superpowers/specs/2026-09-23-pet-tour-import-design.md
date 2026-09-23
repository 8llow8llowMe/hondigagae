# 반려동물 동반 조건 적재 — `petTourImportJob` (place_pet_info)

> 대상: `backend/service/batch-service` `domainlayer/placeimport`
> 작성: 2026-09-23
> 상태: **구현 완료** (#877, 2026-09-23) — 계획 `docs/superpowers/plans/2026-09-23-pet-tour-import.md`, 운영 절차 `backend/docs/data-refresh-guide.md` §10

**Goal:** dev 에 0건인 `place_pet_info` 를 채운다. 테이블·`PlacePetInfoEntity`·응답 DTO 는 이미 있고
채우는 잡만 없었다. 반려견 동반 조건은 이 서비스의 핵심 데이터다.

**Non-goal:** `place` 행의 필터·적합도 컬럼(`pet_allowance_type` · `allowed_pet_size`) 갱신.
동반 조건 자유 텍스트의 규칙 확장(가공 enum 설계). 적재 지표(`place_import_rows`) 추가.

---

## 1. 실측 (2026-09-23, 실호출)

| 무엇 | `areaCode=39` | `lDongRegnCd=50` |
| --- | --- | --- |
| `areaBasedList2` totalCount | 23 | **330** |
| `petTourSyncList2` totalCount | 31 | **336** (노출 330 · 내림 6) |

- `lDongRegnCd=50` 330건 중 307건은 `areacode=""` 다. **#726 을 그대로 재현한다** — `areaCode` 로 물으면 93% 가 빠진다.
- 타입 분포(`lDongRegnCd=50` 목록): 쇼핑 276 · 관광지 44 · 문화 4 · 레포츠 3 · 숙박 2 · 음식점 1.
- `detailPetTour2` 표본 29건: `acmpyTypeCd` 는 "전구역 동반가능" 16 · "일부구역 동반가능" 13 **두 값뿐**.
  필드 최대 길이 82자 — 엔티티 컬럼 길이 안.
- 목록에 없는 contentId(1839477) 상세는 `items=""` 로 온다.

## 2. 결정

### 2-1. 쿼터 — 대상을 동기화 목록으로 먼저 좁힌다

한 실행 = `petTourSyncList2` **1콜** + `detailPetTour2` **노출 ∩ place 마스터(≤ 330)콜**.

- 2,099곳 전량에 상세를 부르지 않는다. 동반 정보가 있는 곳은 원천이 목록으로 주고, 나머지는 `items=""` 로 버려진다.
- **쿼터는 KorService2 와 따로다.** 공공데이터포털은 활용신청한 API 마다 일 1,000건을 센다.
  `placeImportJob` 의 704 와 경쟁하지 않고 `1 + 330 = 331 < 1,000` 이라 **매 실행 전량을 돈다.**
- 그래도 실행당 상한(`pet-tour-import.max-calls-per-run`, 기본 350)과 "행 없는 곳 먼저 → `synced_at`
  오래된 순 → id" 증분 선정을 둔다. 지역 키가 무시돼 전국 10,152건이 오는 날의 천장이다.
  동기화 목록 페이지도 20페이지 천장을 둔다.
- 서킷 오픈·키 누락·한도 초과는 스텝을 멈춘다(`PlaceImportErrorCode.stopsTheStep`, intro 와 같다).

### 2-2. 지역 키 — `lDongRegnCd`

§1 표 그대로. 잡 파라미터는 관광 `areaCode=39` 로 받고 원천 조회에서만 `RegionCodeMapping` 으로
법정동 시도코드로 옮긴다(KorService2 어댑터와 같은 규칙). 모르는 지역은 즉시 `REGION_NOT_SUPPORTED`.

### 2-3. 정규화 범위 — 원문 보존 + 기존 규칙으로만 NOT NULL 세 칸

이슈는 "1차는 원문만" 이었는데 **엔티티가 가공 세 칸을 NOT NULL 로 이미 갖고 있다**
(`allowanceScope` · `allowedPetSize` · `leashRequired`). 값을 넣지 않고는 행을 쓸 수 없다.

- 원문 아홉 칸은 그대로 저장한다(빈 문자열만 null).
- 세 칸은 **새 해석 규칙을 만들지 않는 선**에서 채운다:
  - `allowedPetSize` — 이미 관광 API 표기를 다루는 `PetFieldParser.parseAllowedPetSize` 재사용
  - `allowanceScope` — 실측 두 값("전구역" / "일부구역")만 옮기고 나머지는 `UNKNOWN`
  - `leashRequired` — 원천이 "목줄"·"리드줄" 을 말했을 때만 true. 화면은 true 일 때만 배지를 그린다
- **`place` 의 필터·적합도 컬럼은 건드리지 않는다.** 그쪽은 목록 필터와 적합도 판정을 바꾸므로 별도 이슈다.
- 전부 모르는 것(`UNKNOWN`)으로 넣는 안은 버렸다 — 장소 상세가 `petInfo` 를 받으면 크기 배지를
  그리는데(`place-detail-section.tsx`), 원문이 "전 견종 동반 가능" 인 곳에 "정보 없음" 이 붙는다.

### 2-4. 실행 위치 — 파이프라인 마지막 자식

`placeDataPipelineJob` 의 여섯 번째 자식으로 넣는다(주 1회 자동). TourAPI place 행이 있어야 붙일 수
있으므로 `placeImportJob` 뒤면 되고, 쿼터가 따로라 앞 단계와 다투지 않는다. 맨 뒤에 두면 앞 다섯
단계의 순서와 설명을 건드리지 않는다. 단독 실행(`petTourImportJob`)도 된다.

스케줄 겹침 금지는 **파이프라인 쪽에만** 더했다(`QuartzScheduleConfig.PLACE_PIPELINE_BLOCKED_BY`).
공용 목록(`PLACE_JOBS_BLOCKED_BY`)은 "place 마스터를 건드리는 잡" 이고 혼잡도도 그것을 보는데, 이 잡은
`place_pet_info` 만 써서 혼잡도가 기다릴 이유가 없다. 파이프라인은 단독 실행과 겹치면 같은 상세를 두 번
불러 쿼터를 두 배로 쓰므로 막는다.

### 2-5. 건수 가드 — 필요 없다

`ImportVolumeGuard` 는 "적게 받았는데 그만큼 delist 하는" 사고를 막는 장치다. 이 잡에는 그 경로가 없다.

- **지우는 근거는 `showflag=0` 뿐이다.** 목록에 없다는 이유로 지우지 않는다. 목록이 반쪽으로 와도
  부르는 수가 줄 뿐 지워지는 행은 없다.
- 목록이 불어나도 place 마스터(제주)와의 교집합과 상한이 호출 수를 묶는다.
- 같은 contentId 가 노출·내림으로 함께 오면 노출을 믿는다.

## 3. 구조

`placeIntroImportStep` 계열을 본떴다.

| 계층 | 파일 |
| --- | --- |
| 잡 | `PetTourImportJobConfig` · `PetTourImportTasklet` · `PlaceDataPipelineJobConfig`(자식 추가) |
| in-port / facade | `PetTourImportUseCase` · `PetTourImportFacade` |
| processor | `PetTourImportProcessor` — 동기화 목록 → 내림 삭제 → 대상 조회 → 상세 루프 |
| out-port | `PlaceCatalogPort` 에 두 메서드 추가 · 신규 `PlacePetInfoBulkPort` |
| adapter | `TourApiPlaceCatalogAdapter`(같은 제공처·키·래퍼·서킷 `tourapi`) · `JdbcPlacePetInfoBulkAdapter` |
| domain | `ImportedPlacePetInfo` · `PetFieldParser`(구역·목줄 두 규칙) |
| 설정 | `PetTourImportProperties`(기본 350) · `application.yml` · compose · `.env.example` |

`touchSyncedAt` 은 intro 와 달리 **행을 만들지 않는다** — `place_pet_info` 는 행이 있는 것 자체가
"동반 정보 있음" 으로 읽힌다. 그래서 행 없는 곳이 비어 오면 다음 실행에서도 앞자리에 온다. 대상이 상한보다
적은 지금(≤ 330 < 350)은 매 실행 전량을 돌아 굶는 곳이 없다.

## 4. 남는 것

- `place.pet_allowance_type` · `allowed_pet_size` 에 이 원천을 반영할지(목록 필터·적합도) — 별도 이슈.
- 행 없는 곳이 비어 오거나 실패하면 `synced_at` 이 NULL 로 남아 매 실행 앞자리를 차지한다. 노출 집합이
  상한을 넘기 시작하면 그런 곳이 상한을 채워 기존 행 갱신이 밀릴 수 있다 — 그때 "시도 시각" 컬럼을 따로 둔다.
- 쿼터가 API 별이라는 판단은 포털 정책 기준이다. 첫 dev 실행 뒤 마이페이지 트래픽 화면으로 확인한다.
