package com.hondigagae.domainlayer.place.application.service.processor;

import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.place.application.info.NearbyPlaceInfo;
import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceImageInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceIntroInfo;
import com.hondigagae.domainlayer.place.application.info.PlacePetDetailInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSitemapEntryInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceKeyword;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.domainlayer.place.domain.model.PlaceOpenState;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceQueryProcessor {

    private final PlaceRepositoryPort placeRepositoryPort;
    private final PlaceSearchCachePort placeSearchCachePort;

    /**
     * 장소 목록. 기준 좌표가 있으면 거리순, 없으면 {@code placeId} 오름차순이다 (#1202).
     *
     * <p>키워드 캐시는 두 목록이 같이 탄다 — 캐시 키에 기준 좌표가 들어가므로 둘이 한 키를 나눠 쓰지 않는다.
     */
    public PlaceSummariesInfo getPlaces(PlaceSearchCriteria criteria) {
        PlaceSearchCriteria query = criteria.toBuilder()
            .keyword(PlaceKeyword.normalizeForSearch(criteria.keyword()).orElse(null))
            .build();
        if (query.keyword() != null) {
            var cached = placeSearchCachePort.findList(query);
            if (cached.isPresent()) {
                return cached.get();
            }
        }
        PlaceSummariesInfo info = query.hasOrigin() ? findPlacesByDistance(query) : findPlacesById(query);
        if (query.keyword() != null) {
            placeSearchCachePort.putList(query, info);
        }
        return info;
    }

    /**
     * 좌표 없는 목록 — {@code placeId} 오름차순 커서. ai-service 의 후보 조회가 좌표 없이 이 경로를 타므로
     * 쿼리·순서를 바꾸지 않는다. 항목의 {@code distanceMeters} 는 null 이다.
     */
    private PlaceSummariesInfo findPlacesById(PlaceSearchCriteria query) {
        PlaceSliceQueryResult queryResult = placeRepositoryPort.findPlaces(query);
        List<PlaceSummaryInfo> summaries = queryResult.places().stream()
            .map(this::toSummaryInfo)
            .toList();
        return new PlaceSummariesInfo(summaries, queryResult.hasNext());
    }

    /**
     * 거리순 목록 (#1202). 정렬 키는 <b>(반올림 거리 m, placeId) 오름차순</b>이고 응답 {@code distanceMeters} 가 그 거리다 —
     * 주변 검색과 같은 계산·같은 동률 규칙이라 두 화면의 거리와 순서가 어긋나지 않는다.
     *
     * <ol>
     *   <li>필터에 맞는 후보의 아이디·좌표를 <b>전량</b> 받아 거리를 잰다. 반경 제한은 없다.</li>
     *   <li>커서가 있으면 그 장소의 좌표로 커서 키를 되살리고 키가 그보다 큰 것만 남긴다. 커서가 {@code lastPlaceId}
     *       하나여도 (거리, id) 가 전순서라 동률이 많아도 페이지 사이에 중복·누락이 없다.</li>
     *   <li>{@code size + 1} 개를 골라 hasNext 를 판정하고, 고른 아이디로 엔티티를 읽어 <b>고른 순서대로 다시 세운다</b> —
     *       IN 조회는 순서를 보장하지 않는다.</li>
     * </ol>
     *
     * <p>제주 2,300여 곳이라 페이지마다 후보 좌표 전량을 메모리에서 정렬해도 싸다. 전국으로 넓히면 공간 인덱스나
     * DB 정렬로 옮겨야 하는 지점이 여기다 (주변 검색의 같은 주석과 같은 판단).
     */
    private PlaceSummariesInfo findPlacesByDistance(PlaceSearchCriteria query) {
        DistanceRank cursor = query.lastPlaceId() == null ? null : cursorRank(query);
        List<DistanceRank> ranked = placeRepositoryPort.findCoordinates(query).stream()
            .map(row -> new DistanceRank(row.placeId(), distanceMeters(query.lat(), query.lng(), row.lat(), row.lng())))
            .filter(rank -> cursor == null || DistanceRank.ORDER.compare(rank, cursor) > 0)
            .sorted(DistanceRank.ORDER)
            .limit(query.size() + 1L)
            .toList();
        boolean hasNext = ranked.size() > query.size();
        List<DistanceRank> page = hasNext ? ranked.subList(0, query.size()) : ranked;

        // 페이지 한 장을 IN 한 번으로 읽는다(N+1 아님). 후보를 고른 뒤 읽기 전에 숨겨진 장소는 조용히 빠진다 —
        // 다음 페이지 커서는 응답 마지막 항목이라 이어지는 데 문제가 없다.
        Map<Long, Place> placesById = placeRepositoryPort.findVisiblePlaces(page.stream().map(DistanceRank::placeId).toList())
            .stream()
            .collect(Collectors.toMap(Place::id, Function.identity()));
        List<PlaceSummaryInfo> summaries = page.stream()
            .filter(rank -> placesById.containsKey(rank.placeId()))
            .map(rank -> toSummaryInfo(placesById.get(rank.placeId()), rank.distanceMeters()))
            .toList();
        return new PlaceSummariesInfo(summaries, hasNext);
    }

    /**
     * 커서 장소의 거리 키. 좌표는 노출 여부와 무관하게 읽는다 — 직전 페이지의 마지막 장소가 그사이 숨겨져도 이어진다.
     * 장소가 없거나 좌표가 없으면 이어 갈 기준이 없어 400 이다.
     */
    private DistanceRank cursorRank(PlaceSearchCriteria query) {
        PlaceCoordinateQueryResult cursor = placeRepositoryPort.findCoordinateById(query.lastPlaceId())
            .orElseThrow(() -> new PlaceException(PlaceErrorCode.DISTANCE_CURSOR_INVALID));
        return new DistanceRank(cursor.placeId(), distanceMeters(query.lat(), query.lng(), cursor.lat(), cursor.lng()));
    }

    /** 응답에 싣는 거리이자 정렬 키. 목록 거리순과 주변 검색이 이 한곳에서 같은 반올림을 쓴다. */
    private static int distanceMeters(double fromLat, double fromLng, BigDecimal toLat, BigDecimal toLng) {
        return (int) Math.round(GeoDistance.meters(fromLat, fromLng, toLat.doubleValue(), toLng.doubleValue()));
    }

    /** 거리순 정렬·커서 비교 키. 정렬과 커서가 같은 비교자를 써야 페이지 경계에서 어긋나지 않는다. */
    private record DistanceRank(long placeId, int distanceMeters) {

        // 거리(m 반올림)는 동률이 흔하다 — 아이디로 순서를 고정해야 커서 하나로 다음 페이지가 정해진다.
        private static final Comparator<DistanceRank> ORDER =
            Comparator.comparingInt(DistanceRank::distanceMeters).thenComparingLong(DistanceRank::placeId);
    }

    /**
     * 사각 범위 결과를 정확한 반경으로 다듬고 가까운 순으로 자른다.
     *
     * <p>제주 장소가 수백 곳 규모라 메모리 정렬 비용이 문제 되지 않는다. 전국으로 넓히면
     * 공간 인덱스로 옮겨야 하는 지점이 여기다.
     *
     * <p><b>총계는 자르기 전에 센다</b>(이슈 #285). 자른 뒤에 세면 {@code size} 와 늘 같은
     * 값이 나와, 반경 안에 몇 곳이 더 있는지 응답만으로는 알 수 없게 된다.
     */
    public NearbyPlacesInfo getNearbyPlaces(NearbyPlaceCriteria criteria) {
        NearbyPlaceCriteria query = criteria.toBuilder()
            .keyword(PlaceKeyword.normalizeForSearch(criteria.keyword()).orElse(null))
            .build();
        if (query.keyword() != null) {
            var cached = placeSearchCachePort.findNearby(query);
            if (cached.isPresent()) {
                return cached.get();
            }
        }
        List<NearbyPlaceInfo> matched = placeRepositoryPort.findNearby(query).stream()
            .map(place -> toNearbyInfo(place, query))
            .filter(info -> info.distanceMeters() <= query.radius())
            // 거리(m 반올림)는 동률이 흔하다 — 아이디로 순서를 고정하지 않으면 같은 요청이
            // 호출마다 다른 순서를 주고, limit 경계에서는 포함되는 장소 자체가 바뀐다.
            .sorted(Comparator.comparingInt(NearbyPlaceInfo::distanceMeters)
                .thenComparingLong(info -> info.place().placeId()))
            .toList();

        NearbyPlacesInfo info = new NearbyPlacesInfo(
            matched.stream().limit(query.size()).toList(),
            matched.size());
        if (query.keyword() != null) {
            placeSearchCachePort.putNearby(query, info);
        }
        return info;
    }

    private NearbyPlaceInfo toNearbyInfo(Place place, NearbyPlaceCriteria criteria) {
        // 안쪽 place 에는 거리를 싣지 않는다 — 주변 검색의 거리는 바깥 항목이 말한다.
        return NearbyPlaceInfo.builder()
            .place(toSummaryInfo(place))
            .distanceMeters(distanceMeters(criteria.lat(), criteria.lng(), place.lat(), place.lng()))
            .build();
    }

    public List<Long> findVisibleIds(List<Long> placeIds) {
        return placeRepositoryPort.findVisibleIds(placeIds);
    }

    /**
     * 아이디로 장소 요약을 준다. 노출 불가(병합·delisted) 장소는 조용히 빠진다 —
     * 호출한 쪽이 요청 아이디와 대조해 누락을 판단한다.
     */
    public List<PlaceSummaryInfo> getVisiblePlaceSummaries(List<Long> placeIds) {
        return placeRepositoryPort.findVisiblePlaces(placeIds).stream()
            .map(this::toSummaryInfo)
            .toList();
    }

    /**
     * 사이트맵용 장소 전량 (#1135). 캐시를 거치지 않는다 — 크롤러가 하루 몇 번 읽는 세 컬럼 조회다.
     *
     * <p>수정일은 원천 수정일이다. 적재 시각({@code updatedAt})은 배치가 upsert 마다 모든 행을
     * 갱신해 lastmod 로 내보내면 매일 전부 바뀐 것으로 보인다.
     */
    public List<PlaceSitemapEntryInfo> getSitemapPlaces() {
        return placeRepositoryPort.findSitemapEntries().stream()
            .map(entry -> PlaceSitemapEntryInfo.builder()
                .placeId(entry.placeId())
                .petAllowanceType(entry.petAllowanceType())
                .modifiedAt(entry.sourceModifiedAt())
                .build())
            .toList();
    }

    public PlaceDetailInfo getPlaceDetail(long placeId) {
        Place place = placeRepositoryPort.findPlaceById(placeId)
            .orElseThrow(() -> new PlaceException(PlaceErrorCode.NOT_FOUND_PLACE));

        PlaceIntroInfo intro = placeRepositoryPort.findIntroByPlaceId(placeId)
            .map(result -> PlaceIntroInfo.builder()
                .infoCenter(result.infoCenter())
                .useTime(result.useTime())
                .openNow(PlaceOpenState.resolve(result.weeklyHoursSpec(), result.open24(), LocalDateTime.now()))
                .open24(result.open24())
                .restDate(result.restDate())
                .parking(result.parking())
                .chkPet(result.chkPet())
                .chkBabyCarriage(result.chkBabyCarriage())
                .chkCreditCard(result.chkCreditCard())
                .build())
            .orElse(null);

        PlacePetDetailInfo petInfo = placeRepositoryPort.findPetInfoByPlaceId(placeId)
            .map(result -> PlacePetDetailInfo.builder()
                .acmpyTypeCd(result.acmpyTypeCd())
                .acmpyPsblCpam(result.acmpyPsblCpam())
                .acmpyNeedMtr(result.acmpyNeedMtr())
                .etcAcmpyInfo(result.etcAcmpyInfo())
                .relaAcdntRiskMtr(result.relaAcdntRiskMtr())
                .relaFrnshPrdlst(result.relaFrnshPrdlst())
                .relaPosesFclty(result.relaPosesFclty())
                .relaPurcPrdlst(result.relaPurcPrdlst())
                .relaRntlPrdlst(result.relaRntlPrdlst())
                .allowanceScope(result.allowanceScope())
                .allowedPetSize(result.allowedPetSize())
                .leashRequired(result.leashRequired())
                .build())
            .orElse(null);

        List<PlaceImageInfo> images = placeRepositoryPort.findImagesByPlaceId(placeId).stream()
            .map(result -> PlaceImageInfo.builder()
                .originImgUrl(result.originImgUrl())
                .smallImageUrl(result.smallImageUrl())
                .imgName(result.imgName())
                .cpyrhtDivCd(result.cpyrhtDivCd())
                .build())
            .toList();

        /*
          place_image 는 TourAPI 추가 이미지 배치가 채우는 테이블이라 비어 있을 수 있고,
          문화정보원·식약처 원천 장소는 추가 이미지 API 자체가 없다. 대표 이미지가 있으면
          한 장짜리 갤러리로 폴백한다 — 프론트가 firstImage 를 따로 조립하지 않아도
          상세 갤러리가 성립하고, 배치가 채우면 자연히 원본 목록으로 대체된다.
        */
        if (images.isEmpty() && place.firstImage() != null && !place.firstImage().isBlank()) {
            images = List.of(PlaceImageInfo.builder()
                .originImgUrl(place.firstImage())
                .smallImageUrl(place.firstImage2())
                .imgName(place.title())
                .cpyrhtDivCd(place.cpyrhtDivCd())
                .build());
        }

        return PlaceDetailInfo.builder()
            .place(place)
            .intro(intro)
            .petInfo(petInfo)
            .images(images)
            .build();
    }

    private PlaceSummaryInfo toSummaryInfo(Place place) {
        return toSummaryInfo(place, null);
    }

    /** @param distanceMeters 거리순 목록에서만 값이 있다. 그 밖에는 null */
    private PlaceSummaryInfo toSummaryInfo(Place place, Integer distanceMeters) {
        return PlaceSummaryInfo.builder()
            .placeId(place.id())
            .contentType(ContentType.fromCode(place.contentTypeId()))
            .title(place.title())
            .addr1(place.addr1())
            .sigunguCode(place.sigunguCode())
            .lat(place.lat())
            .lng(place.lng())
            .firstImage(place.firstImage())
            .firstImage2(place.firstImage2())
            .petAllowanceType(place.petAllowanceType())
            .allowedPetSize(place.allowedPetSize())
            .maxPetWeightKg(place.maxPetWeightKg())
            .tel(place.tel())
            .indoor(place.indoor())
            .sourceCategory(place.sourceCategory())
            .source(place.source())
            .distanceMeters(distanceMeters)
            .build();
    }
}
