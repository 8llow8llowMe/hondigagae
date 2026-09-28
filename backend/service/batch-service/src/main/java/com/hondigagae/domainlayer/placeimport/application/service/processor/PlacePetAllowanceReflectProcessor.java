package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetAllowanceCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetAllowanceEvidenceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.PetAllowancePolicy;
import com.hondigagae.domainlayer.placeimport.domain.model.ReflectedPetAllowance;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.ArrayList;
import java.util.EnumMap;
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

        Map<PetAllowanceType, Integer> distribution = new EnumMap<>(PetAllowanceType.class);
        int sizeRestricted = 0;
        List<ReflectedPetAllowance> changes = new ArrayList<>();
        for (PlacePetAllowanceEvidenceQueryResult evidence : evidences) {
            ReflectedPetAllowance reflected = reflect(evidence);
            distribution.merge(reflected.allowance(), 1, Integer::sum);
            if (reflected.size().hasRestriction()) {
                sizeRestricted++;
            }
            if (isChanged(reflected, evidence)) {
                changes.add(reflected);
            }
        }

        int changed = changes.isEmpty() ? 0 : placePetAllowanceCommandPort.updatePetAllowances(changes);
        PetAllowanceReflectOutcome outcome = new PetAllowanceReflectOutcome(evidences.size(), changed, distribution, sizeRestricted);
        log.info("pet allowance reflected. targets={}, changed={}, ALLOWED={}, PARTIALLY_ALLOWED={}, NOT_ALLOWED={}, UNKNOWN={}, sizeRestricted={}",
            outcome.targets(), outcome.changed(), outcome.countOf(PetAllowanceType.ALLOWED), outcome.countOf(PetAllowanceType.PARTIALLY_ALLOWED),
            outcome.countOf(PetAllowanceType.NOT_ALLOWED), outcome.countOf(PetAllowanceType.UNKNOWN), outcome.sizeRestricted());
        return outcome;
    }

    private static boolean isChanged(ReflectedPetAllowance reflected, PlacePetAllowanceEvidenceQueryResult evidence) {
        return !reflected.allowance().name().equals(evidence.currentAllowance())
            || !reflected.size().name().equals(evidence.currentSize())
            || reflected.petAvailable() != evidence.currentPetAvailable();
    }

    private ReflectedPetAllowance reflect(PlacePetAllowanceEvidenceQueryResult evidence) {
        List<PetAllowanceType> allowances = new ArrayList<>();
        allowances.add(PetAllowancePolicy.allowanceOfScope(evidence.petInfoScope()));
        evidence.absorbedAllowances().forEach(value -> allowances.add(PetAllowancePolicy.parseAllowance(value)));

        List<AllowedPetSize> sizes = new ArrayList<>();
        sizes.add(PetAllowancePolicy.parseSize(evidence.petInfoSize()));
        evidence.absorbedSizes().forEach(value -> sizes.add(PetAllowancePolicy.parseSize(value)));

        return new ReflectedPetAllowance(evidence.placeId(),
            PetAllowancePolicy.mostRestrictiveAllowance(allowances), PetAllowancePolicy.mostRestrictiveSize(sizes));
    }
}
