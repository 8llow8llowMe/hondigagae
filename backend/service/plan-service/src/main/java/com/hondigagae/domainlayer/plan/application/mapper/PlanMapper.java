package com.hondigagae.domainlayer.plan.application.mapper;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanItemEntity;
import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPackingItemEntity;
import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPetEntity;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPackingItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
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

    // 엔티티 -> 도메인
    PlanPet toDomainFromEntity(PlanPetEntity entity);

    // 도메인 -> 엔티티
    PlanPetEntity toEntityFromDomain(PlanPet planPet);

    // 엔티티 리스트 -> 도메인 리스트
    List<PlanPet> toPetDomainListFromEntityList(List<PlanPetEntity> entities);

    // 도메인 리스트 -> 엔티티 리스트
    List<PlanPetEntity> toPetEntityListFromDomainList(List<PlanPet> pets);

    // 엔티티 -> 도메인
    PlanPackingItem toDomainFromEntity(PlanPackingItemEntity entity);

    // 도메인 -> 엔티티 (createdAt 은 BaseEntity 의 감사 필드라 저장 시 채워진다)
    PlanPackingItemEntity toEntityFromDomain(PlanPackingItem packingItem);

    // 엔티티 리스트 -> 도메인 리스트
    List<PlanPackingItem> toPackingDomainListFromEntityList(List<PlanPackingItemEntity> entities);

    // 도메인 리스트 -> 엔티티 리스트
    List<PlanPackingItemEntity> toPackingEntityListFromDomainList(List<PlanPackingItem> items);
}
