package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedEmergencyFacility;
import java.util.List;

public interface EmergencyFacilityBulkPort {

    void upsertAll(List<ImportedEmergencyFacility> facilities);
}
