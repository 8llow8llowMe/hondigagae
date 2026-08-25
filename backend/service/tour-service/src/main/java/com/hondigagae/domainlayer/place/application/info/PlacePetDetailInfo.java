package com.hondigagae.domainlayer.place.application.info;

import com.hondigagae.domainlayer.place.domain.enums.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceScope;
import lombok.Builder;

@Builder
public record PlacePetDetailInfo(
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
