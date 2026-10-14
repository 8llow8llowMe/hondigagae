package com.hondigagae.domainlayer.placeimport.application.model;

/**
 * 장소 보정 적용 결과 (#1434).
 *
 * @param entries              보정 파일의 항목 수
 * @param applied              제목이 맞아 적용한 항목 수 — 이미 그 값이라 쓰지 않은 항목도 센다
 * @param changed              값이 달라 실제로 갱신한 행 수
 * @param skippedNotFound      place 에 없는 id 라 건너뛴 항목 수
 * @param skippedTitleMismatch {@code expectedTitle} 과 제목이 달라 건너뛴 항목 수
 */
public record PlaceOverrideOutcome(int entries, int applied, int changed, int skippedNotFound, int skippedTitleMismatch) {
}
