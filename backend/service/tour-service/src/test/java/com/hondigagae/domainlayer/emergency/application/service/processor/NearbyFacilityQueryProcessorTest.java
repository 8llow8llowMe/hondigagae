package com.hondigagae.domainlayer.emergency.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilitiesInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.EmergencyFacilityRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code totalCount} 가 <b>총계인가</b> (이슈 #285).
 *
 * <p>고치기 전에는 프로세서가 {@code size} 로 자른 목록만 넘겼고 프리젠터가 그 목록을 다시 세어
 * {@code totalCount} 를 채웠다. 그래서 dev 실측에서 {@code size} 를 3 / 10 / 50 으로 바꿔 부르면
 * {@code totalCount} 도 3 / 10 / 50 으로 따라왔다 - 이름만 총계이고 실제로는 돌려준 개수였다.
 *
 * <p>그 값을 받은 화면은 잘림을 {@code facilities.length < totalCount} 로 판정했는데, 두 값이
 * 언제나 같으니 조건이 늘 거짓이었다. <b>잘린 목록에서 센 개수가 전체인 양 그대로 나갔다.</b>
 *
 * <p>여기서 고정하는 것은 <b>총계를 자르기 전에 세는가</b>다. 컴파일로는 잡히지 않고, 반경 안
 * 시설이 {@code size} 를 넘는 조회를 실제로 해 봐야만 드러난다.
 */
class NearbyFacilityQueryProcessorTest {

    /** 제주시청. 이슈에 적힌 실측 좌표다. */
    private static final double LAT = 33.4996d;
    private static final double LNG = 126.5312d;

    @Test
    @DisplayName("size 로 잘려도 totalCount 는 반경 안 전체 개수다")
    void totalCountIsNotTruncatedBySize() {
        // 반경 안에 40곳이 있는데 10곳만 달라고 한 상황 - 이 버그가 드러나는 유일한 조건이다.
        NearbyFacilitiesInfo info = processorWith(facilitiesNear(40)).searchNearby(query(10));

        assertThat(info.facilities()).hasSize(10);
        // 회귀 방지의 핵심. 예전에는 이 값이 10 이었다.
        assertThat(info.totalCount()).isEqualTo(40);
    }

    @Test
    @DisplayName("size 를 바꿔도 totalCount 는 움직이지 않는다")
    void totalCountDoesNotFollowSize() {
        List<EmergencyFacilityQueryResult> facilities = facilitiesNear(40);

        // 이슈의 실측 표가 잡아낸 증상이 이것이다 - totalCount 가 size 를 그대로 따라왔다.
        assertThat(processorWith(facilities).searchNearby(query(3)).totalCount()).isEqualTo(40);
        assertThat(processorWith(facilities).searchNearby(query(10)).totalCount()).isEqualTo(40);
        assertThat(processorWith(facilities).searchNearby(query(50)).totalCount()).isEqualTo(40);
    }

    @Test
    @DisplayName("잘리지 않았으면 totalCount 와 돌려준 개수가 같다")
    void totalCountEqualsSizeWhenNothingIsTruncated() {
        NearbyFacilitiesInfo info = processorWith(facilitiesNear(7)).searchNearby(query(50));

        assertThat(info.facilities()).hasSize(7);
        assertThat(info.totalCount()).isEqualTo(7);
    }

    @Test
    @DisplayName("반경 밖 시설은 totalCount 에도 들어가지 않는다")
    void totalCountCountsOnlyMatchedFacilities() {
        // 사각 범위 질의는 원의 모서리 밖까지 준다. 총계도 반경 필터를 통과한 것만 세야 한다 -
        // 여기서 세면 화면이 "반경 안 6곳"이라 말하는데 실제로는 5곳만 있는 일이 생긴다.
        List<EmergencyFacilityQueryResult> mixed = Stream.concat(
            facilitiesNear(5).stream(),
            Stream.of(facility(900L, LAT + 0.5d, LNG))).toList();

        NearbyFacilitiesInfo info = processorWith(mixed).searchNearby(query(50));

        assertThat(info.facilities()).hasSize(5);
        assertThat(info.totalCount()).isEqualTo(5);
    }

    // --- 픽스처 ---------------------------------------------------------------

    private static NearbyFacilityQuery query(int size) {
        return NearbyFacilityQuery.builder()
            .lat(LAT)
            .lng(LNG)
            .radius(10_000)
            .size(size)
            .build();
    }

    /** 반경 10km 안에 촘촘히 놓인 시설들. 위도 0.001도가 약 111m 라 40곳이 모두 반경 안이다. */
    private static List<EmergencyFacilityQueryResult> facilitiesNear(int count) {
        return IntStream.range(0, count)
            .mapToObj(i -> facility(i + 1L, LAT + i * 0.001d, LNG))
            .toList();
    }

    private static EmergencyFacilityQueryResult facility(long id, double lat, double lng) {
        return EmergencyFacilityQueryResult.builder()
            .facilityId(id)
            .facilityType(EmergencyFacilityType.ANIMAL_HOSPITAL)
            .name("시설 " + id)
            .addr("제주특별자치도 제주시")
            .lat(BigDecimal.valueOf(lat))
            .lng(BigDecimal.valueOf(lng))
            .open24(false)
            .build();
    }

    private static NearbyFacilityQueryProcessor processorWith(List<EmergencyFacilityQueryResult> facilities) {
        return new NearbyFacilityQueryProcessor(new EmergencyFacilityRepositoryPort() {
            @Override
            public List<EmergencyFacilityQueryResult> findWithinBox(NearbyFacilityQuery query) {
                // 실제 어댑터와 같이 사각 범위 전량을 돌려준다 - DB 에서 자르지 않는다.
                // 총계를 메모리에서 셀 수 있는 근거가 이것이다.
                return facilities;
            }

            @Override
            public Optional<EmergencyFacilityQueryResult> findById(long facilityId) {
                return Optional.empty();
            }
        });
    }
}
