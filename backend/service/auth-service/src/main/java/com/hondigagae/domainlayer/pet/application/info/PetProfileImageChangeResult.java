package com.hondigagae.domainlayer.pet.application.info;

/**
 * 반려견 프로필 이미지 변경 결과.
 *
 * @param petInfo             갱신된 반려견 정보
 * @param previousObjectKey   교체 전 오브젝트 키. 호출부가 DB 반영 성공 후 이 객체를 삭제해
 *                            고아 파일이 쌓이지 않게 한다. 이전 이미지가 없었으면 null.
 */
public record PetProfileImageChangeResult(

    PetInfo petInfo,

    String previousObjectKey

) {

}
