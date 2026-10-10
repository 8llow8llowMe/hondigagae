package com.hondigagae.domainlayer.insight.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 중기예보 예보구역.
 *
 * <p><b>단기예보와 위치 지정 방식이 다르다.</b> 단기예보는 5km 격자(nx, ny)를 받지만
 * 중기예보는 예보구역 코드({@code regId})를 받는다. 그래서 이 경로에는 {@code KmaGrid} 가
 * 쓰이지 않는다.
 *
 * <p><b>두 오퍼레이션의 코드 체계가 또 서로 다르다.</b>
 * <ul>
 *   <li>중기육상예보({@code getMidLandFcst}) — 도 단위 구역. 제주도 전체가 하나다</li>
 *   <li>중기기온({@code getMidTa}) — 지점 단위. 제주와 서귀포가 갈린다</li>
 * </ul>
 * 이것이 이 연동의 첫 함정이다. 코드 체계를 섞으면 오류가 아니라 <b>조용히 빈 응답</b>이
 * 오는데, 관광 areaCode 와 법정동 코드를 섞었을 때와 똑같은 증상이다.
 *
 * <p><b>2026-08-27 실호출로 검증했다.</b> 세 코드가 모두 유효하고, 같은 회차에서 기온이
 * 제주 최고 32도 / 서귀포 31도로 갈렸다. 지점을 나눈 것이 실제로 의미가 있다는 뜻이다.
 */
@Getter
@RequiredArgsConstructor
public enum MidTermRegion {

    /**
     * 제주시 기준. 한라산 북쪽이다.
     *
     * <p>육상예보는 제주도 전체가 한 구역이라 두 값이 같고, 기온만 지점이 갈린다.
     */
    JEJU_SI("11G00000", "11G00201", "제주시"),

    /** 서귀포시 기준. 한라산 남쪽이라 기온이 제주시와 눈에 띄게 다르다. */
    SEOGWIPO_SI("11G00000", "11G00401", "서귀포시");

    /** 중기육상예보 예보구역코드 (날씨/강수확률). */
    private final String landRegId;
    /** 중기기온 지점번호 (최고/최저기온). */
    private final String temperatureRegId;
    private final String displayName;

    /** 관광 시군구코드 기준 판정. 서귀포시=3, 제주시=4 (entity-design.md). */
    private static final String SIGUNGU_SEOGWIPO = "3";
    private static final String SIGUNGU_JEJU = "4";

    /**
     * 한라산 능선 부근 위도. 시군구코드가 없을 때 좌표로 갈라내는 기준선이다.
     *
     * <p>정밀한 행정 경계가 아니라 <b>기온 구역을 고르기 위한 근사</b>다. 경계 근처 몇 킬로미터가
     * 반대로 잡히더라도 중기예보의 해상도(오전/오후, 도 단위)를 생각하면 무의미한 차이다.
     */
    private static final double HALLA_RIDGE_LAT = 33.36d;

    /**
     * 장소가 속한 구역을 고른다.
     *
     * <p>시군구코드를 우선하고 없으면 위도로 갈라낸다. 코드를 먼저 보는 이유는 그것이 원천이
     * 준 사실이기 때문이고, 위도 폴백을 두는 이유는 원천마다 시군구 매핑 품질이 달라
     * 비어 있는 행이 실제로 존재하기 때문이다.
     *
     * @param sigunguCode 관광 시군구코드. null 이거나 알 수 없는 값이면 위도로 판정한다
     * @param lat         장소 위도
     */
    public static MidTermRegion of(String sigunguCode, double lat) {
        if (SIGUNGU_SEOGWIPO.equals(sigunguCode)) {
            return SEOGWIPO_SI;
        }
        if (SIGUNGU_JEJU.equals(sigunguCode)) {
            return JEJU_SI;
        }
        return lat < HALLA_RIDGE_LAT ? SEOGWIPO_SI : JEJU_SI;
    }

    /** 캐시 키 조각. 지역 단위라 제주 전체가 두 개 키로 덮인다. */
    public String cacheKey() {
        return landRegId + ":" + temperatureRegId;
    }
}
