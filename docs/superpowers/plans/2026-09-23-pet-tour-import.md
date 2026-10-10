# 반려동물 동반 조건 적재 Implementation Plan

**Goal:** `place_pet_info` 를 채우는 `petTourImportJob` 을 만들고 `placeDataPipelineJob` 마지막 자식으로 잇는다.

**Architecture:** `placeIntroImportStep` 계열(장소당 1콜 + 실행당 상한 + 증분 대상 선정)을 본뜬다. 앞에
동기화 목록 1콜로 대상 contentId 집합을 좁히는 단계가 붙는다. 원천 호출은 기존
`TourApiPlaceCatalogAdapter` 에 얹는다(같은 제공처·키·응답 래퍼·서킷).

**Spec:** `docs/superpowers/specs/2026-09-23-pet-tour-import-design.md`

**Issue:** [#877](https://github.com/8llow8llowMe/hondigagae/issues/877)

## Global Constraints

- 파일 인코딩은 UTF-8 (no BOM).
- 커밋 prefix `[BE]`, 문서만이면 `[DOCS]`.
- `git add -A` · `git add .` · `git stash` 금지. 경로별 스테이징.
- 검증: `cd backend && ./gradlew :service:batch-service:cleanTest :service:batch-service:test --no-build-cache`
  (`cleanTest` 와 `--no-build-cache` 를 빼면 캐시로 한 건도 안 돌고 통과한다).

---

## Task 1 — 원천 계약과 해석

- `PlaceCatalogPort` 에 `fetchPetTourSyncList(areaCode, pageNo, numOfRows)` · `fetchDetailPetTour(contentId)`.
- `PetTourSyncQueryResult`(entries: contentId + shown, totalCount, `hasNext`).
- `TourApiPlaceCatalogAdapter` — `KorPetTourService2` 경로, 지역은 `lDongRegnCd`. 응답 해석
  (`toPetTourSyncResult` · `toPlacePetInfo`)은 package-private 로 떼어 HTTP 없이 테스트한다.
- `items=""` → 빈 결과. 아홉 칸 전부 빈 아이템 → 빈 결과. `showflag` 는 `"0"` 일 때만 내림.
- 테스트: `TourApiPetTourParsingTest` — URI 두 종, 빈 문자열 items(목록·상세), 단일 객체 item,
  showflag 분기, 한도 초과 본문.

## Task 2 — 가공 세 칸

- `ImportedPlacePetInfo`(원문 9 + 가공 3).
- `PetFieldParser.parseAllowanceScope` · `parseLeashRequired` 추가. 크기는 기존 `parseAllowedPetSize` 재사용.
- 테스트: `PetFieldParserTest` 에 2026-09-23 실측 원문으로 세 규칙.

## Task 3 — 쓰기 포트

- `PlacePetInfoBulkPort` / `JdbcPlacePetInfoBulkAdapter` — `findTourApiTargets(contentIds, limit)`,
  `upsert`(id = placeId, 컬럼 길이로 자르기), `touchSyncedAt`(UPDATE 만), `deleteByContentIds`.
- 테스트: `JdbcPlacePetInfoBulkAdapterTest` — 자르기, 가공 칸 바인딩, 대상 SQL 조건, touch 가 INSERT 없음,
  삭제 범위, 빈 인자 접기.

## Task 4 — 프로세서 · 잡 · 설정

- `PetTourImportProcessor` — 동기화 목록 페이징(빈 페이지·20페이지 천장) → 내림 삭제 → 대상 조회 → 상세 루프.
  실패는 touch 후 계속, `stopsTheStep` 코드는 전파.
- `PetTourImportUseCase` · `PetTourImportFacade` · `PetTourImportTasklet` · `PetTourImportJobConfig`.
- `PlaceDataPipelineJobConfig` 에 `petTourImportJobStep` 을 마지막으로.
- `PetTourImportProperties`(기본 350) 등록, `application.yml` · compose · `.env.example`.
- 테스트: `PetTourImportProcessorTest`, `PetTourImportPropertiesTest`, `BatchServiceApplicationTests` 잡 목록.

## Task 5 — 문서

- `backend/docs/services/batch-service.md` — 잡 표에 추가, "계획 (미착수)" 에서 제거.
- `backend/docs/data-api-analysis.md` §4 — 지역 키 재측정, 값 분포.
- `backend/docs/data-refresh-guide.md` §10 — 실행·확인 SQL.
