package com.hondigagae.domainlayer.place.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 장소 상세의 반려동물 제한사항 (#1523).
 *
 * <p>상세 Info 는 원천 원문을 {@code PetRestriction} 규칙으로 읽은 값을 싣는다. 원천이 "제한 없음" 을
 * "해당없음" · "제한사항 없음" 이라는 낱말로 보내므로, 원문을 그대로 실으면 화면에 그 낱말이 제한사항처럼 뜬다.
 */
class PlaceQueryProcessorDetailTest {

    private static final long PLACE_ID = 130_308L;

    private final PlaceRepositoryPort placeRepositoryPort = mock(PlaceRepositoryPort.class);
    private final PlaceQueryProcessor processor = new PlaceQueryProcessor(placeRepositoryPort, mock(PlaceSearchCachePort.class));

    @Test
    @DisplayName("제한 원문은 앞뒤 공백만 정리해 싣는다")
    void statedRestrictionIsCarried() {
        givenPlace(" 야외만 반려동물 동반 가능 ");

        PlaceDetailInfo info = processor.getPlaceDetail(PLACE_ID);

        assertThat(info.petRestriction()).isEqualTo("야외만 반려동물 동반 가능");
    }

    @Test
    @DisplayName("쉼표 목록은 쪼개지 않는다")
    void commaListIsCarriedAsIs() {
        givenPlace("목줄, 배변봉투");

        assertThat(processor.getPlaceDetail(PLACE_ID).petRestriction()).isEqualTo("목줄, 배변봉투");
    }

    @ParameterizedTest
    @ValueSource(strings = {"해당없음", "제한사항 없음", "해당 없음", "제한사항없음", "", "  "})
    @DisplayName("'제한 없음' 자리표시와 빈 값은 null 이다")
    void placeholderBecomesNull(String raw) {
        givenPlace(raw);

        assertThat(processor.getPlaceDetail(PLACE_ID).petRestriction()).isNull();
    }

    @Test
    @DisplayName("원천에 값이 없으면 null 이다")
    void absentStaysNull() {
        givenPlace(null);

        assertThat(processor.getPlaceDetail(PLACE_ID).petRestriction()).isNull();
    }

    private void givenPlace(String petRestriction) {
        // 소개 · 반려동물 정보 · 이미지는 비어 있다(mock 기본값: Optional.empty · 빈 목록) — 제한사항만 본다.
        when(placeRepositoryPort.findPlaceById(PLACE_ID)).thenReturn(Optional.of(Place.builder()
            .id(PLACE_ID)
            .source(PlaceSource.CULTURE_PORTAL)
            .sourceKey("culture-130308")
            .contentTypeId("14")
            .title("제주항일기념관")
            .lat(new BigDecimal("33.5326"))
            .lng(new BigDecimal("126.8497"))
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.PARTIALLY_ALLOWED)
            .indoor(false)
            .outdoor(true)
            .petRestriction(petRestriction)
            .build()));
    }
}
