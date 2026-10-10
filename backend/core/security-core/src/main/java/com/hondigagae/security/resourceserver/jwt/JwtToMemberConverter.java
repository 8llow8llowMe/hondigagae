package com.hondigagae.security.resourceserver.jwt;

import com.hondigagae.security.common.dto.MemberLoginActive;
import com.hondigagae.security.common.enums.SecurityRole;
import com.hondigagae.security.common.jwt.JwtAuthentication;
import java.util.Collection;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

public class JwtToMemberConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        // 클레임 추출
        long memberId = Long.parseLong(jwt.getSubject());
        SecurityRole role = SecurityRole.valueOf(jwt.getClaimAsString("role"));

        MemberLoginActive principal = MemberLoginActive.builder()
            .memberId(memberId)
            .role(role)
            .tokenId(jwt.getId())
            .build();

        Collection<? extends GrantedAuthority> authorities =
            List.of(new SimpleGrantedAuthority(role.name()));

        return new JwtAuthentication(principal, "", authorities);
    }
}
