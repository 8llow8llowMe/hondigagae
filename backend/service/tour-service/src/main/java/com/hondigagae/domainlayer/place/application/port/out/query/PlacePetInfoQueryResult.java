package com.hondigagae.domainlayer.place.application.port.out.query;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceScope;
import lombok.Builder;

@Builder
public record PlacePetInfoQueryResult(
    String acmpyTypeCd,
    String acmpyPsblCpam,
    String acmpyNeedMtr,
    String etcAcmpyInfo,
    String relaAcdntRiskMtr,
    String relaFrnshPrdlst,
    String relaPosesFclty,
    String relaPurcPrdlst,
    String relaRntlPrdlst,
    PetAllowanceScope allowanceScope,
    AllowedPetSize allowedPetSize,
    boolean leashRequired
) {

}
