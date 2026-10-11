package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetAllowanceCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetAllowanceEvidenceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.PetAllowancePolicy;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceIdentityPolicy;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceNameMatcher;
import com.hondigagae.domainlayer.placeimport.domain.model.ReflectedPetAllowance;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * TourAPI 노출 장소의 동반 가능 여부 · 크기 제한 · {@code pet_available} 을 근거에서 다시 계산한다 (#886).
 *
 * <p>근거 읽기 한 번 → 규칙({@link PetAllowancePolicy}) → <b>값이 바뀐 행만</b> 갱신. 결과를 통째로 다시 계산하므로
 * {@code place_pet_info} 가 지워지거나 흡수 행이 delist 되면 다음 실행에서 값이 돌아간다.
 *
 * <p><b>두 단계로 계산한다</b> (#1340).
 * <ol>
 *   <li>모든 행을 자기 근거(동반 정보 · 흡수 행)로 계산한다.</li>
 *   <li>하위 시설({@link PlaceIdentityPolicy#isSubFacilityOf} — 본 시설 이름 + 괄호 수식어, 100m 안)은 본 시설의 1단계 결과 중
 *       <b>제한만</b> 근거로 더해 동반 구분을 다시 고른다({@link PetAllowancePolicy#withParentRestriction}). 방향은 본 시설 → 하위
 *       시설 하나뿐이고, 1단계 결과만 물려주므로 상속이 이어지지 않는다. 크기 제한 · {@code pet_restriction} 은 물려주지 않는다.</li>
 * </ol>
 * 문화정보원 행은 TourAPI 행 하나에만 흡수되므로, 본 시설이 흡수 행으로 받은 "야외만" 이 같은 곳의 매장 행
 * ({@code 생각하는 정원[면세점(TAX REFUND SHOP)]})에는 닿지 않아 매장이 자기 근거("전 구역")로 ALLOWED 로 보였다.
 *
 * <p>본 시설 후보는 정규화 이름({@link PlaceNameMatcher#normalize})으로 묶은 맵에서 찾는다 — 대상 2,300곳 남짓이라 메모리에 다 올려도
 * 되고, 행마다 전체를 훑지 않는다. 이름 정규화를 MySQL 정규식으로 하지 않는 것은 병합 판정과 같은 Java 구현을 쓰기 위해서다
 * (MySQL 8 ICU 정규식은 Java 와 동작이 달라 두 판정이 갈라진다).
 *
 * <p>SQL 하나({@code UPDATE place p LEFT JOIN (...) SET ...})로 하지 않은 이유 — 다중 테이블 UPDATE 는 H2(MODE=MySQL)가
 * 받지 않아 실제 SQL 을 테스트로 돌려 볼 수 없고, H2 가 받는 상관 하위 질의 UPDATE 는 흡수 행을 같은 {@code place} 에서
 * 읽어야 해 MySQL 이 ER_UPDATE_TABLE_USED(1093)로 거부한다. 대상이 2,100곳 남짓이라 읽고 나서 바뀐 행만 배치 갱신하는
 * 편이 두 DB 에서 같은 SQL 로 돈다. 규칙이 Java 에 있어 단위 테스트로 고정되는 것은 덤이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlacePetAllowanceReflectProcessor {

    private final PlacePetAllowanceCommandPort placePetAllowanceCommandPort;

    public PetAllowanceReflectOutcome reflectPetAllowances() {
        List<PlacePetAllowanceEvidenceQueryResult> evidences = placePetAllowanceCommandPort.findTourApiEvidences();

        // 1단계 — 자기 근거만으로
        List<ReflectedPetAllowance> ownResults = evidences.stream().map(PlacePetAllowanceReflectProcessor::reflect).toList();
        Map<String, List<ParentCandidate>> parentsByName = parentCandidatesByName(evidences, ownResults);

        Map<PetAllowanceType, Integer> distribution = new EnumMap<>(PetAllowanceType.class);
        int sizeRestricted = 0;
        int inherited = 0;
        List<ReflectedPetAllowance> changes = new ArrayList<>();
        for (int i = 0; i < evidences.size(); i++) {
            PlacePetAllowanceEvidenceQueryResult evidence = evidences.get(i);
            // 2단계 — 하위 시설은 본 시설의 제한을 얹는다
            ReflectedPetAllowance reflected = withParentRestriction(evidence, ownResults.get(i), parentsByName);
            if (reflected.allowance() != ownResults.get(i).allowance()) {
                inherited++;
            }
            distribution.merge(reflected.allowance(), 1, Integer::sum);
            if (reflected.size().hasRestriction()) {
                sizeRestricted++;
            }
            if (isChanged(reflected, evidence)) {
                changes.add(reflected);
            }
        }

        int changed = changes.isEmpty() ? 0 : placePetAllowanceCommandPort.updatePetAllowances(changes);
        PetAllowanceReflectOutcome outcome = new PetAllowanceReflectOutcome(evidences.size(), changed, distribution, sizeRestricted, inherited);
        log.info("pet allowance reflected. targets={}, changed={}, ALLOWED={}, PARTIALLY_ALLOWED={}, NOT_ALLOWED={}, UNKNOWN={}, sizeRestricted={}, "
                + "inherited={}",
            outcome.targets(), outcome.changed(), outcome.countOf(PetAllowanceType.ALLOWED), outcome.countOf(PetAllowanceType.PARTIALLY_ALLOWED),
            outcome.countOf(PetAllowanceType.NOT_ALLOWED), outcome.countOf(PetAllowanceType.UNKNOWN), outcome.sizeRestricted(), outcome.inherited());
        return outcome;
    }

    private static boolean isChanged(ReflectedPetAllowance reflected, PlacePetAllowanceEvidenceQueryResult evidence) {
        return !reflected.allowance().name().equals(evidence.currentAllowance())
            || !reflected.size().name().equals(evidence.currentSize())
            || reflected.petAvailable() != evidence.currentPetAvailable();
    }

    private static ReflectedPetAllowance reflect(PlacePetAllowanceEvidenceQueryResult evidence) {
        List<PetAllowanceType> allowances = new ArrayList<>();
        allowances.add(PetAllowancePolicy.allowanceOfScope(evidence.petInfoScope()));
        evidence.absorbedAllowances().forEach(value -> allowances.add(PetAllowancePolicy.parseAllowance(value)));

        List<AllowedPetSize> sizes = new ArrayList<>();
        sizes.add(PetAllowancePolicy.parseSize(evidence.petInfoSize()));
        evidence.absorbedSizes().forEach(value -> sizes.add(PetAllowancePolicy.parseSize(value)));

        return new ReflectedPetAllowance(evidence.placeId(),
            PetAllowancePolicy.mostRestrictiveAllowance(allowances), PetAllowancePolicy.mostRestrictiveSize(sizes));
    }

    /** 본 시설이 될 수 있는 행(수식어 없음 · 좌표 있음 · 정규화 이름이 비지 않음)을 정규화 이름으로 묶는다. 1단계 결과를 함께 든다. */
    private static Map<String, List<ParentCandidate>> parentCandidatesByName(
        List<PlacePetAllowanceEvidenceQueryResult> evidences, List<ReflectedPetAllowance> ownResults
    ) {
        Map<String, List<ParentCandidate>> parentsByName = new HashMap<>();
        for (int i = 0; i < evidences.size(); i++) {
            PlacePetAllowanceEvidenceQueryResult evidence = evidences.get(i);
            String name = PlaceNameMatcher.normalize(evidence.title());
            if (name.isEmpty() || !evidence.hasCoordinates() || PlaceIdentityPolicy.hasFacilityQualifier(evidence.title())) {
                continue;
            }
            parentsByName.computeIfAbsent(name, key -> new ArrayList<>()).add(new ParentCandidate(evidence, ownResults.get(i).allowance()));
        }
        return parentsByName;
    }

    /**
     * 하위 시설이면 본 시설 후보들의 1단계 결과 중 제한을 얹은 값을, 아니면 1단계 결과를 그대로 돌려준다.
     * 크기 제한은 자기 근거의 값을 그대로 둔다 — 본 시설의 크기 제한이 매장에도 맞는다는 근거가 없다.
     */
    private static ReflectedPetAllowance withParentRestriction(
        PlacePetAllowanceEvidenceQueryResult child, ReflectedPetAllowance own, Map<String, List<ParentCandidate>> parentsByName
    ) {
        if (!child.hasCoordinates() || !PlaceIdentityPolicy.hasFacilityQualifier(child.title())) {
            return own;
        }
        List<ParentCandidate> candidates = parentsByName.getOrDefault(PlaceNameMatcher.normalize(child.title()), List.of());
        List<PetAllowanceType> parentAllowances = new ArrayList<>();
        List<Long> parentIds = new ArrayList<>();
        for (ParentCandidate candidate : candidates) {
            PlacePetAllowanceEvidenceQueryResult parent = candidate.evidence();
            double distance = PlaceNameMatcher.distanceMeters(parent.lat(), parent.lng(), child.lat(), child.lng());
            if (PlaceIdentityPolicy.isSubFacilityOf(parent.title(), child.title(), distance)) {
                parentAllowances.add(candidate.allowance());
                parentIds.add(parent.placeId());
            }
        }
        PetAllowanceType allowance = PetAllowancePolicy.withParentRestriction(own.allowance(), parentAllowances);
        if (allowance == own.allowance()) {
            return own;
        }
        log.info("pet allowance inherited from parent facility. placeId={}, parentIds={}, own={}, inherited={}",
            child.placeId(), parentIds, own.allowance(), allowance);
        return new ReflectedPetAllowance(own.placeId(), allowance, own.size());
    }

    /** 본 시설 후보 한 곳과 그 1단계 결과. */
    private record ParentCandidate(PlacePetAllowanceEvidenceQueryResult evidence, PetAllowanceType allowance) {
    }
}
