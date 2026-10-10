package com.hondigagae.security.common.jwt;

import com.hondigagae.security.common.dto.MemberLoginActive;
import java.util.Collection;
import lombok.Getter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

@Getter
public class JwtAuthentication extends AbstractAuthenticationToken {

    private final MemberLoginActive principal;
    private final Object credentials;

    public JwtAuthentication(MemberLoginActive principal, Object credentials,
        Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        this.credentials = credentials;
        super.setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return this.credentials;
    }

    @Override
    public Object getPrincipal() {
        return this.principal;
    }
}
