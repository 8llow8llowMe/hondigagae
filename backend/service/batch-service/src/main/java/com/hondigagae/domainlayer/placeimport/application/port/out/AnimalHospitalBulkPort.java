package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedAnimalHospital;
import java.util.List;

public interface AnimalHospitalBulkPort {

    void upsertAll(List<ImportedAnimalHospital> hospitals);
}
