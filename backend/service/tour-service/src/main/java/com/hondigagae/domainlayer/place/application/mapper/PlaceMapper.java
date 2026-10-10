package com.hondigagae.domainlayer.place.application.mapper;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PlaceMapper {

    Place toDomain(PlaceEntity entity);

    List<Place> toDomains(List<PlaceEntity> entities);
}
