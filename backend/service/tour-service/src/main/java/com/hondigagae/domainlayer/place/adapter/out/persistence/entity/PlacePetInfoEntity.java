package com.hondigagae.domainlayer.place.adapter.out.persistence.entity;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceScope;
import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;

@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "place_pet_info",
    indexes = {
        @Index(name = "uk_place_pet_info_place_id", columnList = "placeId", unique = true)
    }
)
public class PlacePetInfoEntity extends BaseEntity {

    @Id
    @Comment("반려동물 동반 정보 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("장소 아이디 (FK: place.id)")
    private Long placeId;

    @Column(length = 100)
    @Comment("동반 유형 원문 (acmpyTypeCd — \"전구역 동반가능\" 등)")
    private String acmpyTypeCd;

    @Column(length = 300)
    @Comment("동반 가능 동물 원문 (acmpyPsblCpam — \"전 견종\", \"10kg 미만\" 등)")
    private String acmpyPsblCpam;

    @Column(length = 500)
    @Comment("동반 시 필요사항 원문 (acmpyNeedMtr — \"목줄 착용\" 등)")
    private String acmpyNeedMtr;

    @Column(columnDefinition = "TEXT")
    @Comment("기타 동반 정보 원문 (etcAcmpyInfo — 개행 포함 장문)")
    private String etcAcmpyInfo;

    @Column(length = 500)
    @Comment("사고 대비사항 원문 (relaAcdntRiskMtr)")
    private String relaAcdntRiskMtr;

    @Column(length = 300)
    @Comment("비치 품목 원문 (relaFrnshPrdlst)")
    private String relaFrnshPrdlst;

    @Column(length = 300)
    @Comment("부대시설 원문 (relaPosesFclty — 운동장 등)")
    private String relaPosesFclty;

    @Column(length = 300)
    @Comment("구매 가능 품목 원문 (relaPurcPrdlst)")
    private String relaPurcPrdlst;

    @Column(length = 300)
    @Comment("대여 가능 품목 원문 (relaRntlPrdlst)")
    private String relaRntlPrdlst;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("동반 가능 구역 (acmpyTypeCd 가공)")
    private PetAllowanceScope allowanceScope;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("동반 가능 크기 (acmpyPsblCpam 가공)")
    private AllowedPetSize allowedPetSize;

    @Column(nullable = false)
    @Comment("목줄 필요 여부 (acmpyNeedMtr 가공)")
    private boolean leashRequired;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
