package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.domain.enums.MergeNameMatch;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 제주 실측 사례를 고정한다. 판정값을 조정할 때 여기가 먼저 깨지게 만들어,
 * 반경 하나를 바꾸면 어떤 실측 사례가 뒤집히는지 즉시 드러낸다.
 */
class PlaceIdentityPolicyTest {

    private static final String TOURIST_SPOT = PlaceContentType.TOURIST_SPOT.getCode();
    private static final String CULTURE = PlaceContentType.CULTURE.getCode();
    private static final String LEPORTS = PlaceContentType.LEPORTS.getCode();
    private static final String LODGING = PlaceContentType.LODGING.getCode();

    @Test
    @DisplayName("이름 완전일치는 1,000m 까지 병합하고 그 밖은 병합하지 않는다")
    void mergesExactNameWithinOneKilometer() {
        // 원천마다 기준점이 다르다(오름 정상 vs 입구). 그래서 완전일치 반경을 넉넉히 잡았다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매공원", "노리매공원", 999d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매공원", "노리매공원", 1_001d)).isFalse();
    }

    @Test
    @DisplayName("이름 부분일치는 300m 까지만 병합한다")
    void mergesPartialNameOnlyWithinThreeHundredMeters() {
        // 노리매 ⊂ 노리매공원 — 한쪽이 다른 쪽을 품는 관계다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매", "노리매공원", 99d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매", "노리매공원", 301d)).isFalse();
    }

    @Test
    @DisplayName("서우봉 vs 서우봉둘레길은 부분일치지만 900m 면 병합하지 않는다")
    void doesNotMergePartialNameBeyondThreeHundredMeters() {
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("서우봉", "서우봉둘레길", 900d)).isFalse();
    }

    @Test
    @DisplayName("이름이 겹치지 않으면 93m 라도 병합하지 않는다 — 녹차미로공원 vs 쉼한모금")
    void neverMergesDifferentNamesHoweverClose() {
        // 좌표만 가까운 건은 실제로 별개 시설이었다. 이름이 좌표보다 믿을 만하다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("녹차미로공원", "쉼한모금", 93d)).isFalse();
    }

    @Test
    @DisplayName("도치돌목장 vs 도치돌 알파카목장(99m)은 공통 부분 일치로 병합한다")
    void mergesDochidolPairBySharedCore() {
        // 실측에서 같은 곳으로 확인된 쌍이다. 한쪽이 다른 쪽을 통째로 품지 않아(도치돌목장 ⊄ 도치돌알파카목장)
        // 부분일치로는 못 잡고, #363 에서 이 테스트로 "아직 안 걸린다" 를 고정해 두었다. #1282 로 뒤집었다.
        assertThat(PlaceNameMatcher.isPartialMatch("도치돌목장", "도치돌 알파카목장")).isFalse();
        assertThat(PlaceIdentityPolicy.mergeNameMatch("도치돌목장", "도치돌 알파카목장", 99d))
            .contains(MergeNameMatch.SHARED_CORE);
    }

    @Test
    @DisplayName("공통 부분 일치는 dev 실측의 같은 곳 쌍을 받는다")
    void sharedCoreAcceptsMeasuredSamePlaces() {
        // dev 2026-10-08 — 모두 같은 곳이고 대부분 주소까지 같다.
        assertThat(PlaceNameMatcher.isSharedCoreMatch("서귀포시기당미술관", "서귀포시립기당미술관")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("제주도립미술관", "제주특별자치도립미술관")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("러브랜드미술관", "제주러브랜드")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("제주4·3평화기념관", "제주4·3평화공원")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("월령리선인장군락", "월령 선인장군락지")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("테지움사파리", "테디베어하우스 테지움")).isTrue();
    }

    @Test
    @DisplayName("공통 부분이 지역명 · 시설 유형뿐이거나 이름의 귀퉁이만 겹치면 받지 않는다")
    void sharedCoreRejectsGenericOrMarginalOverlap() {
        // 미술관만 겹친다 (dev 125m, 다른 곳)
        assertThat(PlaceNameMatcher.isSharedCoreMatch("러브랜드미술관", "제주특별자치도립미술관")).isFalse();
        // 지역명만 겹친다 (dev 416m, 다른 곳)
        assertThat(PlaceNameMatcher.isSharedCoreMatch("제주특별자치도 문예회관", "제주특별자치도 민속자연사박물관")).isFalse();
        // 제주대 = 제주 + 1자 — 일반 낱말을 걷으면 1자만 남는다 (dev 192m, 다른 곳)
        assertThat(PlaceNameMatcher.isSharedCoreMatch("제주대학교박물관", "제주대 벚꽃길")).isFalse();
        // 3자 미만 공통 부분
        assertThat(PlaceNameMatcher.isSharedCoreMatch("성산카페", "성산식당")).isFalse();
        // 완전일치 · 부분일치는 더 강한 판정이 받으므로 여기서는 false 다
        assertThat(PlaceNameMatcher.isSharedCoreMatch("노리매", "노리매공원")).isFalse();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("노리매공원", "노리매 공원")).isFalse();
    }

    @Test
    @DisplayName("공통 부분 일치는 인자 순서와 무관하다 — 같은 길이의 공통 부분이 둘이면 어느 하나라도 조건을 보면 받는다")
    void sharedCoreIsSymmetric() {
        // 최장 공통 부분이 '서귀포시'(지역명뿐)와 '기당로터'(고유) 둘이다. 하나만 보던 구현은 순서에 따라 답이 갈렸다.
        assertThat(PlaceNameMatcher.isSharedCoreMatch("서귀포시기당로터", "기당로터서귀포시")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("기당로터서귀포시", "서귀포시기당로터")).isTrue();
        assertThat(PlaceNameMatcher.isSharedCoreMatch("도치돌 알파카목장", "도치돌목장"))
            .isEqualTo(PlaceNameMatcher.isSharedCoreMatch("도치돌목장", "도치돌 알파카목장"));
    }

    @Test
    @DisplayName("공통 부분 일치는 100m 까지만 병합한다 — 경계 포함")
    void mergesSharedCoreOnlyWithinOneHundredMeters() {
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("도치돌목장", "도치돌 알파카목장", 100d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("도치돌목장", "도치돌 알파카목장", 101d)).isFalse();
    }

    @Test
    @DisplayName("이름 판정은 완전일치 · 부분일치 · 공통 부분 일치 순으로 강하다")
    void namesMatchStrengthInDeclaredOrder() {
        assertThat(PlaceIdentityPolicy.mergeNameMatch("노리매공원", "노리매공원", 0d)).contains(MergeNameMatch.EXACT);
        assertThat(PlaceIdentityPolicy.mergeNameMatch("노리매", "노리매공원", 0d)).contains(MergeNameMatch.CONTAINED);
        assertThat(MergeNameMatch.EXACT).isLessThan(MergeNameMatch.CONTAINED);
        assertThat(MergeNameMatch.CONTAINED).isLessThan(MergeNameMatch.SHARED_CORE);
    }

    @Test
    @DisplayName("코스 행(대괄호 머리)과는 종류가 같아도 병합하지 않는다 — 김만덕기념관 · 올레 18코스")
    void neverMergesIntoCourseRow() {
        assertThat(PlaceIdentityPolicy.isMergeableKind(CULTURE, LEPORTS, "[제주올레 18코스] 김만덕기념관-조천 올레")).isFalse();
        assertThat(PlaceIdentityPolicy.isMergeableKind(LEPORTS, LEPORTS, "[한라산 둘레길 1구간] 천아숲길")).isFalse();
        // 대괄호가 머리가 아니면 코스가 아니다
        assertThat(PlaceIdentityPolicy.isMergeableKind(TOURIST_SPOT, TOURIST_SPOT, "성산일출봉 [유네스코 세계자연유산]")).isTrue();
        // 여행코스(25)는 이름과 무관하게 코스다 — 제주는 지금 0건이지만 적재 대상으로 남아 있다
        assertThat(PlaceIdentityPolicy.isMergeableKind(TOURIST_SPOT, PlaceContentType.COURSE.getCode(), "동부 해안 코스")).isFalse();
    }

    @Test
    @DisplayName("한쪽만 숙박이면 병합하지 않고, 숙박과 레포츠(캠핑장)는 병합한다")
    void mergesLodgingOnlyWithLodgingOrLeports() {
        // 에코랜드(테마파크) → 에코랜드 호텔, 제주양떼목장펜션 → 제주양떼목장 (dev 오병합)
        assertThat(PlaceIdentityPolicy.isMergeableKind(CULTURE, LODGING, "에코랜드 호텔")).isFalse();
        assertThat(PlaceIdentityPolicy.isMergeableKind(LODGING, TOURIST_SPOT, "제주양떼목장")).isFalse();
        // 서귀포 캠파제주(펜션) → 캠파제주(레포츠 28, 같은 주소)
        assertThat(PlaceIdentityPolicy.isMergeableKind(LODGING, LEPORTS, "캠파제주")).isTrue();
        assertThat(PlaceIdentityPolicy.isMergeableKind(LEPORTS, LODGING, "캠파제주")).isTrue();
        assertThat(PlaceIdentityPolicy.isMergeableKind(LODGING, LODGING, "포시즌펜션")).isTrue();
        assertThat(PlaceIdentityPolicy.isMergeableKind(CULTURE, TOURIST_SPOT, "노리매공원")).isTrue();
    }

    @Test
    @DisplayName("이미지 백필은 완전일치 500m 이내만 채운다")
    void backfillsOnlyExactNameWithinFiveHundredMeters() {
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매공원", "노리매공원", 499d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매공원", "노리매공원", 501d)).isFalse();
    }

    @Test
    @DisplayName("이미지 백필은 부분일치면 거리와 무관하게 채우지 않는다")
    void neverBackfillsPartialName() {
        // 틀린 사진이 붙는 것이 사진이 없는 것보다 나쁘다. 병합보다 엄격한 이유다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매", "노리매공원", 1d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("서우봉", "서우봉둘레길", 10d)).isFalse();
    }

    @Test
    @DisplayName("반경은 경계를 포함한다 — 정확히 1,000m·300m·500m 인 쌍도 같은 곳이다")
    void radiiAreInclusive() {
        // <= 가 < 로 바뀌면 여기서 먼저 뒤집힌다. 실측 쌍이 경계값에 걸리는 일이 실제로 있다.
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("서우봉", "서우봉", 1_000d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForMerge("노리매", "노리매공원", 300d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSamePlaceForImageBackfill("노리매공원", "노리매공원", 500d)).isTrue();
    }

    @Test
    @DisplayName("긴급 시설은 이름·전화·1,000m 를 모두 만족해야 접는다")
    void foldsEmergencyFacilityOnlyWhenNameTelAndDistanceAgree() {
        // #569 dev 실측 — 이름의 공백 한 칸만 다르고 주소·전화·좌표가 같았다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "24시똑똑똑 동물메디컬센터", "064-749-7585", "24시똑똑똑동물메디컬센터", "064-749-7585", 0d)).isTrue();
        // 표기가 달라도 숫자가 같으면 같은 번호로 본다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "큰곰동물약국", "0647449952", "큰곰동물약국", "064-744-9952", 0d)).isTrue();
    }

    @Test
    @DisplayName("전화가 같아도 이름이 다르면 접지 않는다 — 제주 실측 오병합 반례")
    void neverFoldsDifferentNamesSharingOneTel() {
        /*
         * 제주 214곳 중 전화를 공유하는 번호가 5개인데 셋은 이름이 전혀 다른 별개 시설이다.
         * 전화 단독 키를 쓰면 이 셋이 한 곳으로 접힌다.
         */
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "태흥동물병원", "064-722-3440", "나음동물병원", "064-722-3440", 100d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "사랑동물병원", "064-745-9975", "봄이든 동물병원", "064-745-9975", 100d)).isFalse();
        // 같은 건물(수덕로 41)에 있는 약국 3곳이라 거리가 0 이어도 접으면 안 된다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "두리약국", "064-744-9952", "밝은사랑약국", "064-744-9952", 0d)).isFalse();
    }

    @Test
    @DisplayName("이름·전화가 같아도 1,000m 를 넘으면 접지 않는다 — 같은 상호의 다른 지점")
    void neverFoldsFarBranchesSharingNameAndTel() {
        // 전국 실측: 노형꿈동물병원 3,502m, 백화점약국 10.6km, 경남수의동물병원 48km, 22세기 약국 143km.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "노형 꿈 동물병원", "064-744-1128", "노형꿈동물병원", "064-744-1128", 3_502d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "22세기 약국", "053-741-1075", "22세기 약국", "053-741-1075", 143_772d)).isFalse();
        // 경계는 포함한다.
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "노형꿈동물병원", "064-744-1128", "노형꿈동물병원", "064-744-1128", 1_000d)).isTrue();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "노형꿈동물병원", "064-744-1128", "노형꿈동물병원", "064-744-1128", 1_001d)).isFalse();
    }

    @Test
    @DisplayName("전화가 없으면 접지 않는다 — 거리 가드를 걸 근거가 약해진다")
    void neverFoldsWithoutTel() {
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility("한림동물병원", null, "한림동물병원", null, 0d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility("한림동물병원", "", "한림동물병원", "", 0d)).isFalse();
        assertThat(PlaceIdentityPolicy.isSameEmergencyFacility(
            "한림동물병원", "064-796-8253", "한림동물병원", null, 0d)).isFalse();
    }

    @Test
    @DisplayName("반경 값은 실측으로 정한 그대로다")
    void keepsMeasuredRadii() {
        assertThat(PlaceIdentityPolicy.MERGE_EXACT_NAME_RADIUS_M).isEqualTo(1_000d);
        assertThat(PlaceIdentityPolicy.MERGE_PARTIAL_NAME_RADIUS_M).isEqualTo(300d);
        assertThat(PlaceIdentityPolicy.MERGE_SHARED_NAME_RADIUS_M).isEqualTo(100d);
        assertThat(PlaceIdentityPolicy.IMAGE_BACKFILL_RADIUS_M).isEqualTo(500d);
        assertThat(PlaceIdentityPolicy.EMERGENCY_DUPLICATE_RADIUS_M).isEqualTo(1_000d);
    }
}
