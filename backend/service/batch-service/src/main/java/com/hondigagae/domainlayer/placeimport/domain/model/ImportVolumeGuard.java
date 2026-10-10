package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * 전량 적재 건수 가드 (#726).
 *
 * <p>{@link DelistGuard} 와 막는 것이 다르다. DelistGuard 는 "직전 활성 건수 대비 이번이 얼마나
 * 줄었는가"라는 <b>상대</b> 비교라, 원천이 처음부터 절반만 주기 시작한 상태를 잡지 못한다 —
 * 그 상태가 이어지면 활성 건수도 함께 줄어 비율은 늘 정상으로 보인다. 실제로 TourAPI 가 지역
 * 필터 체계를 바꾼 뒤 제주 2,124건 중 880건만 들어오는 동안 잡은 매번 초록으로 끝났다.
 *
 * <p>그래서 여기서는 <b>절대</b> 범위를 본다. 하한은 원천 필터가 조용히 어긋난 경우를, 상한은
 * 지역 필터가 아예 풀려 전국이 들어온 경우를 잡는다. 둘 다 "잡이 성공으로 끝나면 안 되는" 상태다.
 */
public final class ImportVolumeGuard {

    private ImportVolumeGuard() {
    }

    /**
     * 이번 적재 건수를 기대 범위와 대조한다.
     *
     * <p>전량 실행에서만 부른다 — 일부 contentType 만 도는 부분 실행은 당연히 적게 들어오므로
     * 하한을 걸면 매번 실패한다.
     */
    public static boolean withinRange(long importedCount, int minRows, int maxRows) {
        return importedCount >= minRows && importedCount <= maxRows;
    }
}
