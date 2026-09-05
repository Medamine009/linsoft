package com.pfe.events.eventservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthConverter jwtAuthConverter;

    public SecurityConfig(JwtAuthConverter jwtAuthConverter) {
        this.jwtAuthConverter = jwtAuthConverter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Sondes Kubernetes/OpenShift et scraping Prometheus : sans cette
                // ouverture, `anyRequest().authenticated()` renvoie 401 et le pod
                // est déclaré non sain en permanence.
                .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/events/*/public").permitAll() // détail public (billet)
                // File des demandes de modification / annulation : vue de modération
                .requestMatchers(HttpMethod.GET, "/api/events/changes/pending").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/events/**").authenticated()
                // Trancher une demande de l'organisateur relève du seul administrateur
                .requestMatchers(HttpMethod.PUT, "/api/events/*/change/*").hasRole("ADMIN")
                // L'ajustement de places est ouvert à tout authentifié (registration-service propage le JWT du user)
                .requestMatchers(HttpMethod.PUT, "/api/events/*/seats").authenticated()
                // Seul l'admin peut approuver / refuser un événement (modération)
                .requestMatchers(HttpMethod.PUT, "/api/events/*/status").hasRole("ADMIN")
                // Seuls les organisateurs et admins peuvent créer ou modifier un événement
                .requestMatchers(HttpMethod.POST, "/api/events/**").hasAnyRole("ORGANISATEUR", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/events/**").hasAnyRole("ORGANISATEUR", "ADMIN")
                // Seuls les admins peuvent supprimer (ou peut-être l'organisateur aussi, selon le besoin)
                .requestMatchers(HttpMethod.DELETE, "/api/events/**").hasAnyRole("ADMIN", "ORGANISATEUR")
                // Toute autre requête nécessite d'être authentifié
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter))
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        return http.build();
    }
}
