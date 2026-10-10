# [BE] feat: 배치 적재 메트릭 노출 (place_import_rows · last_success)

> 이슈 등록 전 초안. 등록하면 파일명 앞에 이슈 번호를 붙인다 (`_index.md` 규칙).

## 어떤 기능인가요? ✏

- 배치가 조용히 멈추면 에러율도 지연도 정상인 채 장소 데이터만 몇 주씩 낡는다.
  지금은 적재 결과가 `log.info` 건수뿐이라 "마지막으로 언제 성공했나"에 답할 수 없다.
- `observability-guide.md` "배치 지표" 절이 정의한 지표 둘을 Micrometer 로 노출한다.

```
place_import_rows{source, result}            # upserted / delisted / geocode_failed
place_import_last_success_timestamp{source}  # 소스별 마지막 성공 시각(epoch seconds)
```

## 설계 판단

| 판단 | 근거 |
| --- | --- |
| 행 수를 Counter 가 아니라 **Gauge(마지막 실행 값)** 로 둔다 | 경보 기준(`geocode_failed > 10`, `delisted > 30`)이 실행 단위 값을 전제한다. Counter 누적값은 `increase()` 없이 실행 단위를 못 읽는다 |
| `inserted/updated` 를 나누지 않고 `upserted` 하나로 둔다 | 적재가 JdbcTemplate batchUpdate upsert 라 구분해 세지 않고, 경보도 그 구분을 쓰지 않는다. 가이드 예시(`inserted / updated`)는 이 결정에 맞춰 갱신 |
| last_success 는 **단조 증가**로만 갱신 | 기동 씨딩과 실행 중 기록이 어느 순서로 겹쳐도 최신 값이 남는다 |
| 기동 시 Spring Batch 메타데이터(`BATCH_JOB_EXECUTION`)에서 last_success 를 **씨딩** | 게이지는 메모리에만 있어 재기동하면 사라진다. 씨딩이 없으면 배포 직후 신선도 패널이 다음 잡 실행까지 빈다 |
| 신선도는 **실제로 데이터가 들어온 실행(imported > 0)** 만 갱신 | 원천이 빈 응답을 준 실행을 "성공"으로 남기면 데이터가 낡아도 경보가 울리지 않는다 |
| 긴급 시설·이미지 잡·혼잡도 잡은 이번 범위에서 제외 | `place_import_rows` 는 장소 마스터 기준. 긴급 시설은 급감 가드 + 경고 로그가 별도로 지킨다. 필요해지면 별도 지표로 |

## 작업 상세 내용 📝

- [x] `PlaceImportMetricsPort` (coding-conventions §12-3 인프라 특화 포트) + `PlaceImportResultType`
- [x] `MicrometerPlaceImportMetricsAdapter` — (source, result) 게이지, last_success 단조 증가
- [x] `PlaceImportMetricsSeeder` — 기동 시 잡별 마지막 COMPLETED 실행 종료 시각 씨딩 (best-effort)
- [x] 파사드 3곳 배선 — TourAPI / 문화정보원 / 식약처 (upserted·delisted·last_success)
- [x] `PetRestaurantImportProcessor` 에 geocode_failed 기록 (0 도 기록해 게이지를 리셋)
- [x] 단위 테스트 — 게이지 덮어쓰기·라벨 분리·단조 증가·씨딩 3분기
- [x] `observability-guide.md` / `data-refresh-guide.md` / `feature-status.md` 갱신

## 참고할만한 자료(선택)

- `backend/docs/observability-guide.md` "배치 지표 — 이 프로젝트의 핵심"
- `backend/docs/data-refresh-guide.md` §6 갱신 상태를 드러내기
