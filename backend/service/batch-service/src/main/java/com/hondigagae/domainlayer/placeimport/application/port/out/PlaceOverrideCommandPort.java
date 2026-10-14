package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceOverrideTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.OverridablePlace;
import java.util.Collection;
import java.util.List;

/**
 * 장소 보정을 place 행에 적용하는 계약 (#1434).
 *
 * <p>원천을 가리지 않는다 — 보정은 id 로 행 하나를 가리키고, 그 행이 어느 원천이든 적힌 칸을 덮는다. 노출 여부(병합 · delist)도 보지 않는다.
 * 적용 판정(id · 제목)과 지금 값 · 보정 값 합치기는 도메인({@code PlaceOverride})이 하고, 이 포트는 읽고 그대로 쓴다.
 */
public interface PlaceOverrideCommandPort {

    /** 보정 대상 행의 지금 값. 없는 id 는 결과에 없다. 한 번의 {@code IN} 조회로 읽는다. */
    List<PlaceOverrideTargetQueryResult> findTargets(Collection<Long> placeIds);

    /**
     * 보정을 얹은 결과로 다섯 칸({@code indoor} · {@code outdoor} · {@code pet_allowance_type} · {@code allowed_pet_size} · {@code pet_available})을
     * 그대로 쓴다. {@code place.title} 이 결과의 제목과 같을 때만 쓴다 — 읽은 뒤 제목이 바뀐 행은 건드리지 않는다.
     *
     * @return 갱신한 행 수
     */
    int applyOverrides(List<OverridablePlace> rows);
}
