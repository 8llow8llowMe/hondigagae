package com.hondigagae.domainlayer.place.application.port.out.query;

import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.List;

public record PlaceSliceQueryResult(List<Place> places, boolean hasNext) {

}
