package com.hondigagae.domainlayer.plan.application.mapper;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanItemEntity;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface PlanMapper {

    // 엔티티 -> 도메인
    Plan toDomainFromEntity(PlanEntity entity);

    // 도메인 -> 엔티티
    PlanEntity toEntityFromDomain(Plan plan);

    // 엔티티 -> 도메인
    PlanItem toDomainFromEntity(PlanItemEntity entity);

    // 도메인 -> 엔티티
    PlanItemEntity toEntityFromDomain(PlanItem planItem);

    // 엔티티 리스트 -> 도메인 리스트
    List<PlanItem> toItemDomainListFromEntityList(List<PlanItemEntity> entities);

    // 도메인 리스트 -> 엔티티 리스트
    List<PlanItemEntity> toItemEntityListFromDomainList(List<PlanItem> items);
}
