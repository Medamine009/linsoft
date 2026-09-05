package com.pfe.events.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.header.ReferrerPolicyServerHttpHeadersWriter;
import org.springframework.security.web.server.header.XFrameOptionsServerHttpHeadersWriter;
import reactor.core.publisher.Mono;

import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Sécurité de l'API Gateway — point d'entrée unique de toutes les requêtes du front.
 *
 * Défense en profondeur :
 *  1) Tout passe par ici (les microservices ne sont pas exposés directement).
 *  2) Le gateway valide le JWT (signature + expiration) via les clés publiques de Keycloak
 *     AVANT de router : une requête sans jeton valide est rejetée au bord (401), le trafic
 *     invalide n'atteint jamais les services.
 *  3) On mappe les rôles realm de Keycloak (realm_access.roles) en autorités Spring
 *     (ROLE_ADMIN, ROLE_ORGANISATEUR, ROLE_PARTICIPANT) pour appliquer un contrôle d'accès
 *     par rôle dès le gateway (en plus de celui de chaque service).
 *  4) En-têtes de sécurité HTTP ajoutés à toutes les réponses.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .cors(Customizer.withDefaults())
            // En-têtes de sécurité (anti-clickjacking, anti-sniffing, fuite de referer)
            .headers(headers -> headers
                .frameOptions(frame -> frame.mode(XFrameOptionsServerHttpHeadersWriter.Mode.DENY))
                .contentTypeOptions(Customizer.withDefaults())
                .referrerPolicy(ref -> ref.policy(ReferrerPolicyServerHttpHeadersWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
            )
            .authorizeExchange(exchange -> exchange
                // CORS preflight — pass-through
                .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ── Routes publiques (aucun jeton) ──
                .pathMatchers("/eureka/**", "/actuator/**").permitAll()
                .pathMatchers(HttpMethod.GET, "/api/registrations/*/verify").permitAll()
                .pathMatchers(HttpMethod.GET, "/api/events/*/public").permitAll()
                .pathMatchers(HttpMethod.GET, "/api/tickets/qr/**", "/api/tickets/qr").permitAll()
                // Auto-création de compte à la 1re connexion
                .pathMatchers(HttpMethod.POST, "/api/users").permitAll()

                // ── Contrôle d'accès par rôle (défense en profondeur) ──
                // Administration des collaborateurs → ADMIN
                .pathMatchers(HttpMethod.GET, "/api/users").hasRole("ADMIN")
                .pathMatchers(HttpMethod.DELETE, "/api/users/**").hasRole("ADMIN")
                .pathMatchers(HttpMethod.PUT, "/api/users/keycloak/*/assign-role").hasRole("ADMIN")
                // Diffusion de messages → ADMIN
                .pathMatchers(HttpMethod.POST, "/api/notifications/broadcast").hasRole("ADMIN")
                // Modération d'événements → ADMIN
                .pathMatchers(HttpMethod.PUT, "/api/events/*/status").hasRole("ADMIN")
                // Validation des inscriptions → ORGANISATEUR ou ADMIN
                .pathMatchers(HttpMethod.GET, "/api/registrations/pending").hasAnyRole("ORGANISATEUR", "ADMIN")
                .pathMatchers(HttpMethod.PUT, "/api/registrations/*/approve", "/api/registrations/*/reject").hasAnyRole("ORGANISATEUR", "ADMIN")

                // ── Tout le reste : jeton valide obligatoire ──
                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakRolesConverter()))
            );
        return http.build();
    }

    /**
     * Convertit les rôles realm de Keycloak (claim realm_access.roles) en autorités
     * Spring préfixées ROLE_, pour que hasRole()/hasAnyRole() fonctionnent au gateway.
     */
    private Converter<Jwt, Mono<AbstractAuthenticationToken>> keycloakRolesConverter() {
        JwtGrantedAuthoritiesConverter scopes = new JwtGrantedAuthoritiesConverter();
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Collection<GrantedAuthority> authorities = new HashSet<>(scopes.convert(jwt));
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null && realmAccess.get("roles") instanceof Collection<?> roles) {
                authorities.addAll(roles.stream()
                        .map(r -> new SimpleGrantedAuthority("ROLE_" + String.valueOf(r).toUpperCase()))
                        .collect(Collectors.toSet()));
            }
            return authorities;
        });
        return new ReactiveJwtAuthenticationConverterAdapter(converter);
    }
}
