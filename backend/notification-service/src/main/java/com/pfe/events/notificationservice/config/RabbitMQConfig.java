package com.pfe.events.notificationservice.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE_NAME = "notification.queue";
    public static final String EXCHANGE_NAME = "event.exchange";
    public static final String ROUTING_KEY = "notification.routing.key";

    /** File d'inspection : même flux, aucun consommateur (voir {@link #auditQueue()}). */
    public static final String AUDIT_QUEUE_NAME = "notification.audit.queue";

    @Bean
    public Queue queue() {
        return new Queue(QUEUE_NAME, true);
    }

    /**
     * File de CONSULTATION du flux de notifications.
     *
     * <p>Problème résolu : {@code notification.queue} a un consommateur permanent,
     * elle est donc toujours vide — « Get Message(s) » dans la console RabbitMQ ne
     * renvoie jamais rien, alors qu'on veut pouvoir lire le JSON publié (démo,
     * capture d'écran, débogage).</p>
     *
     * <p>L'exchange étant de type <em>topic</em>, chaque message publié est copié
     * dans TOUTES les files liées à la clé de routage. Cette file reçoit donc la
     * même chose que {@code notification.queue}, mais <strong>personne ne la
     * consomme</strong> : les messages y restent lisibles.</p>
     *
     * <p>Garde-fous pour qu'elle ne grossisse pas indéfiniment : on ne conserve
     * que les 200 derniers messages ({@code drop-head} = le plus ancien saute) et
     * ils expirent au bout de 7 jours. Elle n'a aucun effet sur l'envoi réel des
     * notifications, qui reste assuré par {@code notification.queue}.</p>
     */
    @Bean
    public Queue auditQueue() {
        return QueueBuilder.durable(AUDIT_QUEUE_NAME)
                .withArgument("x-max-length", 200)
                .withArgument("x-overflow", "drop-head")
                .withArgument("x-message-ttl", 604800000)   // 7 jours
                .build();
    }

    @Bean
    public TopicExchange exchange() {
        return new TopicExchange(EXCHANGE_NAME);
    }

    // Deux beans de type Queue existent désormais : on référence explicitement les
    // méthodes de cette @Configuration plutôt que d'injecter par type (ambigu).

    @Bean
    public Binding binding() {
        return BindingBuilder.bind(queue()).to(exchange()).with(ROUTING_KEY);
    }

    @Bean
    public Binding auditBinding() {
        return BindingBuilder.bind(auditQueue()).to(exchange()).with(ROUTING_KEY);
    }
}
