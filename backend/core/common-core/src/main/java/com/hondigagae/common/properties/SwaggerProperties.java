package com.hondigagae.common.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "swagger")
public record SwaggerProperties(
    String serverUrl
) {

}
