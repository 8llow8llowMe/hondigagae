package com.hondigagae.domainlayer.placeimport.application.model;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 장소 적재 결과.
 *
 * <p><b>총합만으로는 delist 범위를 정할 수 없다 (#726).</b> 적재는 contentType 단위로 도는데
 * delist 는 {@code (source, area_code)} 로만 잘랐다. 그 비대칭 때문에 한 타입이 통째로 0건으로
 * 들어와도 총합이 멀쩡하면 건수 가드가 전부 통과하고, 그 타입의 기존 행 전부가 <b>한 번의
 * 실행으로</b> {@code delisted_at} 을 받는다.
 *
 * <p>그래서 타입별 내역을 그대로 올린다. delist 범위는 {@link #importedContentTypes()} — 이번에
 * 1건 이상 들어온 타입뿐이고, 0건인 타입({@link #emptyContentTypes()})은 범위에서 빠져 손대지
 * 않는다. "원천이 그 타입을 지웠다"와 "원천이 그 타입에서 깨졌다"를 여기서는 구분할 수 없으니
 * 안 내리는 쪽이 안전하다.
 *
 * <p><b>"하나라도 0건이면 delist 전체를 건너뛴다"는 답이 아니다.</b> 실측으로 여행코스(25)는
 * {@code areaCode=39}·{@code lDongRegnCd=50} 어느 쪽으로 물어도 항상 0건이다(원천에 제주
 * 여행코스가 없다). 전체를 건너뛰면 delist 가 영영 돌지 않아, 원천에서 사라진 장소가 영구히
 * 남는 또 다른 조용한 실패가 된다.
 *
 * <p>유스케이스 반환값은 계속 총 건수({@link #totalUpserted()})다 — tasklet 이 그 값을 로그에 쓴다.
 *
 * @param upsertedByContentType 이번 실행에서 타입별로 upsert 한 건수. 이번에 돌지 않은 타입은
 *                              키 자체가 없다(부분 실행)
 */
public record PlaceImportOutcome(Map<PlaceContentType, Integer> upsertedByContentType) {

    public PlaceImportOutcome {
        upsertedByContentType = upsertedByContentType == null
            ? Map.of()
            : Collections.unmodifiableMap(new LinkedHashMap<>(upsertedByContentType));
    }

    public int totalUpserted() {
        return upsertedByContentType.values().stream()
            .mapToInt(count -> count == null ? 0 : count)
            .sum();
    }

    /**
     * 이번 실행에서 1건 이상 들어온 타입. <b>delist 범위가 이 목록이다.</b>
     *
     * <p>비어 있으면(전 타입 0건) delist 를 아예 돌리지 않는다 — 원천을 통째로 못 읽은 상태와
     * 구분할 수 없다.
     */
    public List<PlaceContentType> importedContentTypes() {
        return filterByCount(true);
    }

    /**
     * 이번에 돌았는데 한 건도 받지 못한 타입. delist 범위에서 빠진다.
     *
     * <p>여행코스(25)처럼 원천에 애초에 없어서 늘 0건인 타입도 여기 들어온다. 그래서 이 목록이
     * 비어 있지 않다는 것만으로는 이상 신호가 아니다 — DB 에 활성 행이 남아 있는데 0건으로
     * 들어온 경우가 진짜 신호이고, 그 판정은 활성 건수를 아는 {@code DelistProcessor} 가 한다.
     */
    public List<PlaceContentType> emptyContentTypes() {
        return filterByCount(false);
    }

    private List<PlaceContentType> filterByCount(boolean imported) {
        return upsertedByContentType.entrySet().stream()
            .filter(entry -> (entry.getValue() != null && entry.getValue() > 0) == imported)
            .map(Map.Entry::getKey)
            .toList();
    }
}
