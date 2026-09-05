package com.pfe.events.aiservice.dto;

/** Réponse du chatbot. */
public class ChatResponse {

    private String reply;
    private String model;

    public ChatResponse() {}
    public ChatResponse(String reply, String model) {
        this.reply = reply;
        this.model = model;
    }

    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
}
