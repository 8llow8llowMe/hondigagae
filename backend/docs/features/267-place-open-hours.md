# [BE] feat: 여행 장소 영업시간 구조화 — 상세 응답 `openNow`

> 이슈 등록 전 초안. 등록하면 파일명 앞에 이슈 번호를 붙인다 (`_index.md` 규칙).

## 어떤 기능인가요? ✏

- 여행 장소의 운영시간이 원문 문자열(`intro.useTime`)로만 내려가 "지금 가도 되는지"를
  화면이 판단할 수 없다. 긴급 시설에는 이미 있는 `openNow` 판정을 여행 장소 상세에도 붙인다.
- 파서(`OperatingHoursParser`, 실측 기준 여행 장소 원문 93% 해석)와 판정 계약
  (`WeeklySchedule`, shared-travel)은 긴급 시설 구현을 그대로 재사용한다.

## 설계 판단

| 판단 | 근거 |
| --- | --- |
| 구조화는 배치(쓰기), 판정은 tour(읽기) | 긴급 시설과 같은 3층 분리 — 파서는 batch, spec 계약은 shared-travel, `openNow` 판정은 조회 시점 |
| `openNow` 는 3값(true/false/**null=모름**) | 원문을 못 푼 7%를 "닫힘"으로 접으면 열려 있는 장소가 화면에서 지워진다. 긴급 시설과 같은 규칙 |
| 판정 클래스는 place 컨텍스트에 복제 (`PlaceOpenState`) | emergency 의 `FacilityOpenState` 와 같은 규칙이지만 컨텍스트 경계 때문에 클래스는 공유하지 않는다. 세 번째 사용처가 생기면 shared-travel 승격 검토 |
| 원문(`useTime`)은 그대로 보존 | spec 은 조건부 구간("법정공휴일 …")을 버리므로 원문이 항상 더 많은 정보를 갖는다 |
| 상세 응답만, 목록 필터(`openNowOnly`)는 후속 | 목록은 place_intro 조인 + QueryDSL 변경이 필요해 범위를 넘는다 |
| TourAPI `detailIntro2` 수집은 후속 | 현재 place_intro 를 채우는 원천이 문화정보원(약 230곳)뿐. TourAPI 운영시간을 수집해야 커버리지가 넓어진다 |

## 작업 상세 내용 📝

- [x] batch: `ImportedCultureFacility` 에 `weeklyHoursSpec`/`open24` + CSV 어댑터 구조화 (긴급 시설과 같은 규칙)
- [x] batch: `place_intro` upsert 에 `weekly_hours_spec`/`open24` 컬럼 추가
- [x] tour: `PlaceIntroEntity` 컬럼 추가 (스키마 원천은 JPA — batch 는 스키마를 만들지 않는다)
- [x] tour: `PlaceOpenState` 판정 + 상세 응답 `intro.openNow`/`open24` (QueryResult → Info → Presenter → Item 관통)
- [x] 테스트 — `PlaceOpenStateTest`(모름 유지 4분기), `CultureFacilityCsvAdapterTest`(구조화 3분기)
- [x] `place-data-integration.md` / `feature-status.md` 갱신
- [ ] dev 재적재 — 배포 뒤 `cultureFacilityImportJob` 을 다시 돌려 기존 `place_intro` 행을 채운다 (#301).
      컬럼과 코드는 있었고 데이터만 비어 있었다. 재실행 로그 `withWeeklyHoursSpec` 과
      `매일 00:00~24:00` 장소의 `open24: true` 로 확인한다
- [ ] (후속) TourAPI `detailIntro2` 운영시간 수집 → TOUR_API 출처 장소도 spec 커버
- [ ] (후속) 장소 목록 `openNowOnly` 필터 (place_intro 조인)

## 참고할만한 자료(선택)

- `backend/docs/place-data-integration.md` §10-2 (`weekly_hours_spec` 규칙)
- 긴급 시설 선례: `FacilityOpenState`, `NearbyFacilityQueryProcessor`, #37
