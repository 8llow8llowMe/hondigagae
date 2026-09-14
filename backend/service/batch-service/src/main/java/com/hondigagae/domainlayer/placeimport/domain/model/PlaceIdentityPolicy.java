package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * 같은 장소인지 판정하는 기준값의 정본.
 *
 * <p>판정 규칙은 제주 실측(관광 API 29곳 × 문화정보원 171곳)으로 정했다.
 * 자세한 근거는 {@code docs/place-data-integration.md} §4.
 *
 * <p>이름 판정은 {@link PlaceNameMatcher} 가, 얼마나 가까워야 같은 곳으로 볼지는 여기가 정한다.
 * 예전에는 병합 1,000m/300m 는 {@code PlaceMergeProcessor} 안에, 백필 500m 는
 * {@code PlaceImageBackfillProcessor} 안에 따로 있었다. 실측으로 값을 조정할 때 한쪽만 고치면
 * 두 판정의 뜻이 갈라지므로 <b>여기서 한 번에 바꾼다</b>(#363).
 *
 * <p><b>두 반경이 다른 이유</b>: 병합(목록에서 지움)이 백필(사진 한 장)보다 관대한 것은 실측으로
 * 정한 값이며 여기서 한 번에 바꾼다(#363). 병합은 틀려도 두 행이 하나로 보이는 정도이고 원천을
 * 재적재하면 판정을 다시 하지만, 백필은 <b>틀린 사진이 장소에 붙어</b> 사용자가 바로 오해한다.
 * 그래서 백필은 완전일치만 받고 반경도 500m 로 좁게 잡는다.
 */
public final class PlaceIdentityPolicy {

    /** 이름이 완전히 같을 때 병합을 허용하는 거리. 원천마다 기준점이 달라(오름 정상 vs 입구) 넉넉히 잡는다. */
    public static final double MERGE_EXACT_NAME_RADIUS_M = 1_000d;
    /** 이름이 부분적으로만 같을 때 병합을 허용하는 거리. 좁게 잡아 오탐을 막는다. */
    public static final double MERGE_PARTIAL_NAME_RADIUS_M = 300d;
    /** 대표 이미지 백필에서 같은 장소로 볼 거리 상한. 제주 시가지에서 같은 이름의 다른 지점을 걸러내는 값이다. */
    public static final double IMAGE_BACKFILL_RADIUS_M = 500d;
    /**
     * 긴급 시설 중복 접기에서 같은 시설로 볼 거리 상한.
     *
     * <p>병합과 같은 1,000m 지만 <b>근거가 다르다.</b> 저쪽은 "원천마다 기준점이 달라서"(오름 정상 vs 입구)
     * 넉넉히 잡은 값이고, 이쪽은 <b>같은 상호의 다른 지점을 삼키지 않기 위한 상한</b>이다. 전국 CSV 실측에서
     * 이름과 전화가 모두 같은데 1km 를 넘는 조합이 12개 나왔고 전부 별개 지점이었다 —
     * {@code 22세기 약국}(대구/순천 143km), {@code 경남수의동물병원}(창녕/진주 48km),
     * {@code 백화점약국}(안양/광명 10.6km). <b>이 값을 올리지 않는다.</b>
     */
    public static final double EMERGENCY_DUPLICATE_RADIUS_M = 1_000d;

    private PlaceIdentityPolicy() {
    }

    /**
     * 병합해도 되는 같은 장소인지 판정한다.
     *
     * <ul>
     *   <li>이름 완전일치 → {@value #MERGE_EXACT_NAME_RADIUS_M}m 이내</li>
     *   <li>이름 부분일치 → {@value #MERGE_PARTIAL_NAME_RADIUS_M}m 이내</li>
     *   <li>이름이 겹치지 않으면 좌표가 아무리 가까워도 <b>병합하지 않는다.</b>
     *       93m 거리에 서로 다른 시설이 있었다</li>
     * </ul>
     */
    public static boolean isSamePlaceForMerge(String titleA, String titleB, double distanceMeters) {
        if (PlaceNameMatcher.isExactMatch(titleA, titleB)) {
            return distanceMeters <= MERGE_EXACT_NAME_RADIUS_M;
        }
        if (PlaceNameMatcher.isPartialMatch(titleA, titleB)) {
            return distanceMeters <= MERGE_PARTIAL_NAME_RADIUS_M;
        }
        return false;
    }

    /**
     * 대표 이미지를 빌려와도 되는 같은 장소인지 판정한다.
     *
     * <p>완전일치이고 {@value #IMAGE_BACKFILL_RADIUS_M}m 이내여야 한다. 부분일치는 거리와 무관하게
     * 받지 않는다 — 틀린 사진이 붙는 것이 사진이 없는 것보다 나쁘다.
     */
    public static boolean isSamePlaceForImageBackfill(String titleA, String titleB, double distanceMeters) {
        return PlaceNameMatcher.isExactMatch(titleA, titleB) && distanceMeters <= IMAGE_BACKFILL_RADIUS_M;
    }

    /**
     * 긴급 시설 두 행을 같은 시설로 접어도 되는지 판정한다.
     *
     * <p>세 가지를 <b>모두</b> 만족해야 한다 — 이름 완전일치, 전화번호 일치, {@value #EMERGENCY_DUPLICATE_RADIUS_M}m 이내.
     *
     * <p><b>전화만으로는 절대 접지 않는다.</b> 제주 214곳 중 전화를 공유하는 번호가 5개인데 그중 3개는
     * 이름이 전혀 다른 별개 시설이다 — {@code 태흥동물병원}/{@code 나음동물병원}(064-722-3440),
     * {@code 사랑동물병원}/{@code 봄이든 동물병원}(064-745-9975),
     * {@code 두리약국}/{@code 밝은사랑약국}/{@code 큰곰동물약국}(064-744-9952, 같은 건물 3곳).
     *
     * <p><b>전화가 없으면 접지 않는다.</b> 이름과 거리만으로 접는 규칙은 실측으로 검증하지 않았다.
     * 주소 표기까지 같은 행은 이미 {@code sourceKey} 가 접으므로, 여기서 더 접어 얻을 것이 크지 않다.
     *
     * <p>{@link PlaceNameMatcher#isPartialMatch 부분일치}도 받지 않는다. {@code 노형동물병원} 과
     * {@code 노형24시동물병원} 이 같은 곳이라는 근거가 원천에 없다.
     */
    public static boolean isSameEmergencyFacility(
        String nameA, String telA, String nameB, String telB, double distanceMeters) {
        String left = digitsOf(telA);
        String right = digitsOf(telB);
        if (left.isEmpty() || !left.equals(right)) {
            return false;
        }
        return PlaceNameMatcher.isExactMatch(nameA, nameB) && distanceMeters <= EMERGENCY_DUPLICATE_RADIUS_M;
    }

    /** {@code 064-749-7585} 와 {@code 0647497585} 를 같게 본다. 원천이 표기를 섞어 쓴다. */
    private static String digitsOf(String tel) {
        return tel == null ? "" : tel.replaceAll("\\D", "");
    }
}
