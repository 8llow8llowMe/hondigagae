package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.domainlayer.placeimport.domain.enums.MergeNameMatch;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import java.util.Optional;

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
 * 정한 값이며 여기서 한 번에 바꾼다(#363). 백필은 <b>틀린 사진이 장소에 붙어</b> 사용자가 바로 오해하므로
 * 완전일치만 받고 반경도 500m 로 좁게 잡는다.
 *
 * <p><b>병합도 틀리면 그대로 굳는다.</b> 한 번 병합된 행은 다시 후보가 되지 않아(#763) 재적재로도 판정을
 * 다시 하지 않는다 — 사람이 런북({@code data-refresh-guide.md} §12)으로 풀어야 한다. 흡수된 장소는 목록에서
 * 사라지고 그 값이 엉뚱한 survivor 에 옮겨 붙는다. 그래서 이름 겹침이 약할수록 반경을 좁히고, 종류가 맞지 않는
 * 쌍은 이름과 무관하게 막는다({@link #isMergeableKind}, #1282).
 */
public final class PlaceIdentityPolicy {

    /** 이름이 완전히 같을 때 병합을 허용하는 거리. 원천마다 기준점이 달라(오름 정상 vs 입구) 넉넉히 잡는다. */
    public static final double MERGE_EXACT_NAME_RADIUS_M = 1_000d;
    /** 이름이 부분적으로만 같을 때 병합을 허용하는 거리. 좁게 잡아 오탐을 막는다. */
    public static final double MERGE_PARTIAL_NAME_RADIUS_M = 300d;
    /**
     * 이름이 공통 부분으로만 겹칠 때 병합을 허용하는 거리 (#1282).
     *
     * <p>dev 실측(2026-10-08, 병합 안 된 문화정보원 127곳 × 1km 안 관광 API)에서 공통 부분이 3자 이상 겹치는 쌍은
     * <b>100m 안 11쌍이 모두 같은 곳</b>(대부분 주소까지 같다)이었고, 그 밖의 첫 쌍부터 다른 곳이 섞였다 —
     * {@code 러브랜드미술관} · {@code 제주특별자치도립미술관}(125m), {@code 제주대학교박물관} · {@code 제주대 벚꽃길}(192m).
     * 100m 안에서 가장 먼 같은 곳은 {@code 도치돌목장} · {@code 도치돌 알파카목장}(99m)이다. 100m 밖에도 같은 곳이
     * 있지만({@code 항몽유적지} 153m) 다른 곳과 섞여 있어 반경을 넓히지 않았다 — 못 합친 것은 두 곳으로 보일 뿐이고,
     * 잘못 합친 것은 잡이 되돌리지 않는다.
     */
    public static final double MERGE_SHARED_NAME_RADIUS_M = 100d;
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
     * 병합해도 되는 같은 장소인지, 그렇다면 이름이 어떻게 겹쳤는지 판정한다.
     *
     * <ul>
     *   <li>이름 완전일치 → {@value #MERGE_EXACT_NAME_RADIUS_M}m 이내</li>
     *   <li>이름 부분일치(한쪽이 다른 쪽을 품음) → {@value #MERGE_PARTIAL_NAME_RADIUS_M}m 이내</li>
     *   <li>이름 공통 부분 일치({@link PlaceNameMatcher#isSharedCoreMatch}) → {@value #MERGE_SHARED_NAME_RADIUS_M}m 이내</li>
     *   <li>이름이 겹치지 않으면 좌표가 아무리 가까워도 <b>병합하지 않는다.</b>
     *       93m 거리에 서로 다른 시설이 있었다</li>
     * </ul>
     *
     * <p>이름만 본다. 종류 가드는 {@link #isMergeableKind} 가 따로 본다.
     */
    public static Optional<MergeNameMatch> mergeNameMatch(String titleA, String titleB, double distanceMeters) {
        if (PlaceNameMatcher.isExactMatch(titleA, titleB)) {
            return within(MergeNameMatch.EXACT, distanceMeters, MERGE_EXACT_NAME_RADIUS_M);
        }
        if (PlaceNameMatcher.isPartialMatch(titleA, titleB)) {
            return within(MergeNameMatch.CONTAINED, distanceMeters, MERGE_PARTIAL_NAME_RADIUS_M);
        }
        if (PlaceNameMatcher.isSharedCoreMatch(titleA, titleB)) {
            return within(MergeNameMatch.SHARED_CORE, distanceMeters, MERGE_SHARED_NAME_RADIUS_M);
        }
        return Optional.empty();
    }

    /** {@link #mergeNameMatch} 가 어느 단계로든 받는지 — 이름 · 거리만 본다. 종류 가드({@link #isMergeableKind})는 보지 않는다. */
    public static boolean isSamePlaceForMerge(String titleA, String titleB, double distanceMeters) {
        return mergeNameMatch(titleA, titleB, distanceMeters).isPresent();
    }

    private static Optional<MergeNameMatch> within(MergeNameMatch match, double distanceMeters, double radiusMeters) {
        return distanceMeters <= radiusMeters ? Optional.of(match) : Optional.empty();
    }

    /**
     * 흡수 행과 survivor 의 종류가 병합해도 되는 짝인지 판정한다 (#1282). 이름이 아무리 잘 겹쳐도 여기서 막으면 병합하지 않는다.
     *
     * <p>dev 실측(2026-10-08)에서 기존 병합 101쌍 중 셋이 이름은 겹치지만 다른 곳이었고, 모두 아래 두 규칙에 걸린다.
     * <ul>
     *   <li><b>코스와 합치지 않는다.</b> 관광 API 의 코스 행은 이름이 {@code [제주올레 18코스] 김만덕기념관-조천 올레} 처럼
     *       대괄호 머리로 시작한다(dev 35행 — 제주올레 · 하영올레 · 한라산 둘레길, 전부 레포츠 28). 코스 이름이 지나는 장소
     *       이름을 품으므로 부분일치에 걸린다 — {@code 김만덕기념관}이 이 코스에 흡수됐었다. 여행코스(25)도 같은 이유로
     *       막는다 — 제주는 지금 0건이지만 적재 대상으로 남겨 둔 타입이다({@code PlaceContentType.COURSE}).</li>
     *   <li><b>숙박은 숙박하고만 합친다.</b> 한쪽만 숙박(32)이면 병합하지 않는다 — {@code 에코랜드}(테마파크)가
     *       {@code 에코랜드 호텔}에, {@code 제주양떼목장펜션}이 {@code 제주양떼목장}(관광지)에 흡수됐었다. 숙박이 빠지면
     *       AI 일정의 숙소 후보가 줄고, 관광지에 펜션 분류가 옮겨 붙는다. 다만 숙박과 레포츠(28)는 합친다 — 관광 API 는
     *       캠핑장 · 글램핑을 레포츠로 둔다({@code 서귀포 캠파제주}(펜션) → {@code 캠파제주}(28), 같은 주소).</li>
     * </ul>
     *
     * @param absorbedContentTypeId 흡수될 행(문화정보원)의 contentTypeId — 문화정보원 분류를 관광 API 체계로 맞춘 값이다
     *                              ({@code CultureCategoryMapping})
     */
    public static boolean isMergeableKind(String absorbedContentTypeId, String survivorContentTypeId, String survivorTitle) {
        if (isCourseTitle(survivorTitle) || PlaceContentType.COURSE.getCode().equals(survivorContentTypeId)) {
            return false;
        }
        boolean absorbedLodging = isLodging(absorbedContentTypeId);
        boolean survivorLodging = isLodging(survivorContentTypeId);
        if (absorbedLodging == survivorLodging) {
            return true;
        }
        String other = absorbedLodging ? survivorContentTypeId : absorbedContentTypeId;
        return PlaceContentType.LEPORTS.getCode().equals(other);
    }

    private static boolean isCourseTitle(String title) {
        return title != null && title.strip().startsWith("[");
    }

    private static boolean isLodging(String contentTypeId) {
        return PlaceContentType.LODGING.getCode().equals(contentTypeId);
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
        String left = telDigitsOf(telA);
        String right = telDigitsOf(telB);
        if (left.isEmpty() || !left.equals(right)) {
            return false;
        }
        return PlaceNameMatcher.isExactMatch(nameA, nameB) && distanceMeters <= EMERGENCY_DUPLICATE_RADIUS_M;
    }

    /**
     * 전화번호 비교에 쓰는 정규화. {@code 064-749-7585} 와 {@code 0647497585} 를 같게 본다 —
     * 원천이 표기를 섞어 쓴다.
     *
     * <p>접기 후보를 모으는 쪽({@code EmergencyFacilityDeduplicator})도 이것을 쓴다. 같은 정규화를
     * 두 군데에 두면 한쪽만 고쳐졌을 때 "같은 묶음인데 정책은 다르다고 한다" 가 조용히 생긴다.
     */
    public static String telDigitsOf(String tel) {
        return tel == null ? "" : tel.replaceAll("\\D", "");
    }
}
