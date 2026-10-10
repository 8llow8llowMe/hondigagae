package com.hondigagae.domainlayer.placeimport.application.model;

import java.time.LocalDateTime;

/**
 * 문화시설 적재 결과.
 *
 * <p>건수만으로는 스냅샷을 채울 수 없어 {@code sourceModifiedMax} 를 함께 올린다 - 파일이
 * 갱신됐는지 판정하는 보조 근거이고, {@code atchFileId} 규칙이 흔들릴 때 사람이 되짚는 값이다.
 *
 * @param imported          적재한 장소 수
 * @param sourceModifiedMax 적재한 행의 최종작성일 최대값. 원천에 값이 하나도 없으면 null
 */
public record CultureFacilityImportOutcome(int imported, LocalDateTime sourceModifiedMax) {

}
