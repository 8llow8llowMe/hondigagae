package com.hondigagae.domainlayer.member.application.info;

/**
 * 프로필 이미지 변경 결과.
 *
 * @param memberMyInfo        갱신된 회원 정보
 * @param previousObjectKey   교체 전 오브젝트 키. 호출부가 DB 반영 성공 후 이 객체를 삭제해
 *                            고아 파일이 쌓이지 않게 한다. 이전 이미지가 없었으면 null.
 */
public record MemberProfileImageChangeResult(

    MemberMyInfo memberMyInfo,

    String previousObjectKey

) {

}
