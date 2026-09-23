package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 반려동물 동반 조건(KorPetTourService2 detailPetTour2) 적재 설정 (#877).
 *
 * <p><b>쿼터 계산 근거 (2026-09-23 실측).</b> 공공데이터포털은 트래픽을 활용신청한 API 마다 따로
 * 센다 — 반려동물 동반여행 서비스는 KorService2 와 별도로 일 1,000건이고, {@code placeImportJob}
 * 이 쓰는 704 와 겹치지 않는다. 한 실행은 {@code 동기화 목록 1 + 상세 N} 콜이다. 제주 동기화
 * 목록({@code lDongRegnCd=50})이 336건(노출 330 · 내림 6)이라 한 페이지(1,000행)로 끝나고, 상세는
 * 그중 place 마스터와 겹치는 곳에만 부르므로 N ≤ 330 이다.
 *
 * <p>그래서 기본 상한 350 은 <b>평소에는 걸리지 않는 값</b>이다 — 매 실행 전량을 한 번에 돈다
 * ({@code 1 + 330 = 331 < 1,000}). 상한은 원천이 갑자기 불어났을 때(지역 키가 무시돼 전국 10,152건이
 * 오는 경우 등) 하루 예산을 통째로 먹지 않게 하는 천장이다. 대상 선정은 "행 없는 곳 먼저 →
 * synced_at 오래된 순" 이다.
 *
 * <p><b>한계: 행이 없고 상세가 비거나 실패하는 곳은 매 실행 다시 부른다.</b> 빈 행을 만들지 않으므로
 * ({@code PlacePetInfoBulkPort#touchSyncedAt}) 그런 곳은 순환 뒤로 밀리지 않고 늘 맨 앞에 선다.
 * 교집합이 상한 안인 지금은 무해하지만, 상한을 넘으면 그 수만큼 기존 행 갱신 예산이 줄고, 그런 곳이
 * 상한 이상이면 기존 행 갱신이 멈춘다. 그때는 시도 시각을 따로 기록하는 장치가 필요하다.
 *
 * @param maxCallsPerRun 실행당 detailPetTour2 최대 호출 수. 래퍼 타입인 이유는
 *                       {@link PlaceIntroImportProperties} 와 같다 — compose 의 {@code ${VAR:-}} 가
 *                       만든 빈 문자열이 null 로 떨어져도 기동이 깨지지 않게 한다. 비거나 0 이하면 350
 */
@ConfigurationProperties(prefix = "pet-tour-import")
public record PetTourImportProperties(
    Integer maxCallsPerRun
) {

    public PetTourImportProperties {
        if (maxCallsPerRun == null || maxCallsPerRun <= 0) {
            maxCallsPerRun = 350;
        }
    }
}
