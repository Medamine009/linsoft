package com.pfe.events.aiservice.dto;

import java.util.List;

/** Requête envoyée par le frontend au chatbot. */
public class ChatRequest {

    private String message;
    private List<ChatTurn> history; // historique optionnel (multi-tours)

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public List<ChatTurn> getHistory() { return history; }
    public void setHistory(List<ChatTurn> history) { this.history = history; }

    /** Un tour de conversation : role = "user" | "assistant". */
    public static class ChatTurn {
        private String role;
        private String content;

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
