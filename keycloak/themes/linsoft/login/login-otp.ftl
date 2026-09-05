<#--
    Vérification en deux étapes — thème LINSOFT.
    Reprend la structure du gabarit d'origine (mêmes id / name de champs, donc
    même traitement côté Keycloak) et l'habille comme la page de connexion.
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('totp'); section>
    <#if section="header">
        Vérification en deux étapes
    <#elseif section="form">

        <div class="lin-otp">
            <div class="lin-otp-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                    <rect x="7" y="2.5" width="10" height="19" rx="2.4" stroke="currentColor" stroke-width="1.6"/>
                    <path d="M10.8 18.4h2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
            </div>
            <p class="lin-otp-intro">
                Saisissez le code à usage unique affiché par votre application d'authentification.
            </p>
        </div>

        <form id="kc-otp-login-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">

            <#-- Plusieurs authentificateurs enregistrés : choix de l'appareil -->
            <#if otpLogin.userOtpCredentials?size gt 1>
                <div class="${properties.kcFormGroupClass!} lin-otp-devices">
                    <div class="${properties.kcInputWrapperClass!}">
                        <#list otpLogin.userOtpCredentials as otpCredential>
                            <input id="kc-otp-credential-${otpCredential?index}" class="${properties.kcLoginOTPListInputClass!}" type="radio" name="selectedCredentialId" value="${otpCredential.id}" <#if otpCredential.id == otpLogin.selectedCredentialId>checked="checked"</#if>>
                            <label for="kc-otp-credential-${otpCredential?index}" class="${properties.kcLoginOTPListClass!}" tabindex="${otpCredential?index}">
                                <span class="${properties.kcLoginOTPListItemHeaderClass!}">
                                    <span class="${properties.kcLoginOTPListItemIconBodyClass!}">
                                      <i class="${properties.kcLoginOTPListItemIconClass!}" aria-hidden="true"></i>
                                    </span>
                                    <span class="${properties.kcLoginOTPListItemTitleClass!}">${otpCredential.userLabel}</span>
                                </span>
                            </label>
                        </#list>
                    </div>
                </div>
            </#if>

            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="otp" class="${properties.kcLabelClass!}">${msg("loginOtpOneTime")}</label>
                </div>

                <div class="${properties.kcInputWrapperClass!}">
                    <input id="otp" name="otp" autocomplete="one-time-code" type="text"
                           inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="000000"
                           class="${properties.kcInputClass!} lin-otp-code"
                           autofocus aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"/>

                    <#if messagesPerField.existsError('totp')>
                        <span id="input-error-otp-code" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                        </span>
                    </#if>
                </div>
            </div>

            <div class="${properties.kcFormGroupClass!}">
                <div id="kc-form-options" class="${properties.kcFormOptionsClass!}">
                    <div class="${properties.kcFormOptionsWrapperClass!}"></div>
                </div>

                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <input
                        class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                        name="login" id="kc-login" type="submit" value="Vérifier" />
                </div>
            </div>
        </form>

        <p class="lin-otp-help">
            Vous n'avez plus accès à votre application ? Contactez l'administrateur LINSOFT.
        </p>
    </#if>
</@layout.registrationLayout>
