package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.GeocodingPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PetRestaurantCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.Coordinate;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPetRestaurant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 식약처 반려동물 동반출입 음식점 적재.
 *
 * <p>원천에 좌표가 없어 적재 전에 한 건씩 지오코딩한다. 좌표가 없는 장소는 반경 검색에
 * 걸리지 않아 일정에 못 들어가므로 <b>적재하지 않고 버린다</b> — 목록에는 보이는데 지도에는
 * 없는 장소가 생기는 편이 더 나쁘다.
 *
 * <p>매 실행마다 전부 다시 지오코딩한다. 제주 102건, 전국으로 넓혀도 2,600건 수준인데
 * VWorld 한도가 하루 40,000건이라 여유가 크다. 규모가 더 커지면 주소가 바뀐 행만
 * 다시 부르도록 좁혀야 하는 지점이 여기다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetRestaurantImportProcessor {

    private final PetRestaurantCatalogPort petRestaurantCatalogPort;
    private final GeocodingPort geocodingPort;
    private final PlaceBulkPort placeBulkPort;
    private final PlaceImportMetricsPort placeImportMetricsPort;

    public int importPetRestaurants(String region) {
        List<ImportedPetRestaurant> restaurants = petRestaurantCatalogPort.readPetRestaurants(region);
        if (restaurants.isEmpty()) {
            log.warn("mfds pet restaurant import found nothing region={}", region);
            return 0;
        }

        List<ImportedPetRestaurant> located = new ArrayList<>(restaurants.size());
        List<String> unresolved = new ArrayList<>();
        for (ImportedPetRestaurant restaurant : restaurants) {
            Optional<Coordinate> coordinate = geocodingPort.geocode(restaurant.address());
            if (coordinate.isEmpty()) {
                unresolved.add(restaurant.name());
                continue;
            }
            located.add(restaurant
                .withLat(coordinate.get().lat())
                .withLng(coordinate.get().lng()));
        }

        if (!unresolved.isEmpty()) {
            // 조용히 버리지 않는다. 몇 곳이 왜 빠졌는지 로그로 남겨야 원천 문제를 알아챈다.
            log.warn("mfds pet restaurant geocoding failed count={} names={}", unresolved.size(), unresolved);
        }
        // 0 도 기록한다 — 마지막 실행 기준 게이지라, 지난 실행의 실패 건수가 남아 있으면 경보가 늦게 꺼진다
        placeImportMetricsPort.recordRows(PlaceSourceType.MFDS, PlaceImportResultType.GEOCODE_FAILED, unresolved.size());
        if (located.isEmpty()) {
            return 0;
        }

        placeBulkPort.upsertPetRestaurants(located);
        log.info("mfds pet restaurant import done region={} read={} upserted={} skippedNoCoordinate={}",
            region, restaurants.size(), located.size(), unresolved.size());
        return located.size();
    }
}
