package com.hondigagae.domainlayer.placeimport.adapter.out.file;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPetRestaurant;
import com.hondigagae.global.properties.MfdsPetRestaurantProperties;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 식약처 xlsx 파서 검증.
 *
 * <p>고정물은 원천에서 그대로 받은 실제 파일이다(2026-08 기준 전국 2,610곳). 합성 파일로
 * 대신하면 헤더 위치나 공유 문자열 같은 진짜 형식이 검증되지 않는다.
 *
 * <p>내려받기 경로는 타지 않는다 — file-path 가 있으면 그쪽을 읽는 분기라 WebClient 는 쓰이지 않는다.
 */
class MfdsPetRestaurantXlsxAdapterTest {

    private static final Path FIXTURE =
        Path.of("src/test/resources/fixtures/mfds_pet_restaurant.xlsx");

    private MfdsPetRestaurantXlsxAdapter adapter() {
        MfdsPetRestaurantProperties properties = new MfdsPetRestaurantProperties(
            null, null, FIXTURE.toString(), 0);
        // 파일 분기만 타므로 WebClient 와 서킷은 쓰이지 않는다.
        return new MfdsPetRestaurantXlsxAdapter(null, properties, null);
    }

    @Test
    @DisplayName("지역 필터로 제주 등록 업소만 읽고, 업종을 원본 그대로 보존한다")
    void readJejuPetRestaurants() {
        List<ImportedPetRestaurant> restaurants = adapter().readPetRestaurants("제주");

        assertThat(restaurants).hasSize(102);
        assertThat(restaurants).allSatisfy(restaurant -> {
            assertThat(restaurant.name()).isNotBlank();
            assertThat(restaurant.address()).startsWith("제주특별자치도");
            assertThat(restaurant.sourceKey()).isNotBlank();
            // 좌표는 이 단계에서 채우지 않는다. 원천에 없다.
            assertThat(restaurant.hasCoordinate()).isFalse();
            assertThat(restaurant.areaCode()).isEqualTo("39");
        });

        Map<String, Long> byBusinessType = restaurants.stream()
            .collect(Collectors.groupingBy(ImportedPetRestaurant::businessType, Collectors.counting()));
        assertThat(byBusinessType).containsOnlyKeys("일반음식점", "휴게음식점", "제과점영업");
    }

    @Test
    @DisplayName("주소에서 시군구 코드를 읽어 제주시와 서귀포시를 가른다")
    void resolveSigunguFromAddress() {
        List<ImportedPetRestaurant> restaurants = adapter().readPetRestaurants("제주");

        Map<String, Long> bySigungu = restaurants.stream()
            .collect(Collectors.groupingBy(ImportedPetRestaurant::sigunguCode, Collectors.counting()));

        // 제주시=4, 서귀포시=3. 미해석(null)이 하나도 없어야 한다.
        assertThat(bySigungu).containsOnlyKeys("4", "3");
        assertThat(bySigungu.values().stream().mapToLong(Long::longValue).sum()).isEqualTo(102);
    }

    @Test
    @DisplayName("같은 업소는 재실행해도 같은 place id 를 받는다")
    void placeIdIsDeterministic() {
        List<ImportedPetRestaurant> first = adapter().readPetRestaurants("제주");
        List<ImportedPetRestaurant> second = adapter().readPetRestaurants("제주");

        assertThat(first.get(0).placeId()).isEqualTo(second.get(0).placeId());
        assertThat(first.stream().map(ImportedPetRestaurant::placeId).distinct().count())
            .isEqualTo(first.size());
    }

    @Test
    @DisplayName("지역을 지정하지 않으면 전국을 읽는다")
    void readNationwide() {
        assertThat(adapter().readPetRestaurants(null)).hasSize(2610);
    }
}
