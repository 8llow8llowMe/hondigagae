package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * delisting 급감 가드.
 *
 * <p>delisting 은 잘못 돌면 데이터를 통째로 날린다. 식약처 다운로드 경로는 비공식이라
 * 빈 파일이나 오류 페이지가 올 수 있고, 그 상태로 delisting 을 돌리면 등록 업소 전체가
 * 한 번에 사라진다. 그래서 이번 적재 건수가 기존 활성 건수보다 크게 줄었으면
 * delisting 을 건너뛰고 경고만 남긴다.
 *
 * <p>임계 30% 는 원천 성격에 맞춘 값이다. 식약처는 등록이 늘기만 하는 국면이라 감소 자체가
 * 이상 신호고, 문화정보원은 파일이 통째로 바뀌므로 소폭 감소는 정상이다.
 */
public final class DelistGuard {

    /** 직전 활성 건수 대비 이번 적재가 이 비율 밑으로 떨어지면 원천 이상으로 본다. */
    private static final double MIN_SURVIVAL_RATIO = 0.7d;

    private DelistGuard() {
    }

    /**
     * delisting 을 진행해도 되는가.
     *
     * <p>적재 0건은 무조건 막는다 — "원천을 못 읽었다"와 "원천이 빈 목록을 줬다"를
     * 여기서는 구분할 수 없고, 전자일 때 delisting 을 돌리면 전멸이다.
     */
    public static boolean allows(long importedCount, long activeCount) {
        if (importedCount <= 0) {
            return false;
        }
        return importedCount >= activeCount * MIN_SURVIVAL_RATIO;
    }
}
