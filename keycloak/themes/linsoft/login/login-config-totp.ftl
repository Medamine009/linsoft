<#--
    Configuration de la double authentification — thème LINSOFT.
    Structure fonctionnelle identique au gabarit d'origine (id / name des champs
    et macros conservés), présentation alignée sur la page de connexion.
-->
<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<@layout.registrationLayout displayRequiredFields=false displayMessage=!messagesPerField.existsError('totp','userLabel'); section>

    <#if section = "header">
        Activer la double authentification
    <#elseif section = "form">

        <p class="lin-otp-intro">
            Renforcez la sécurité de votre compte : un code temporaire sera demandé à chaque connexion.
        </p>

        <ol id="kc-totp-settings" class="lin-steps">
            <li>
                <p class="lin-step-t">${msg("loginTotpStep1")}</p>
                <ul id="kc-totp-supported-apps" class="lin-apps">
                    <#list totp.supportedApplications as app>
                        <li>${msg(app)}</li>
                    </#list>
                </ul>
            </li>

            <#if mode?? && mode = "manual">
                <li>
                    <p class="lin-step-t">${msg("loginTotpManualStep2")}</p>
                    <p><span id="kc-totp-secret-key" class="lin-secret">${totp.totpSecretEncoded}</span></p>
                    <p><a href="${totp.qrUrl}" id="mode-barcode">${msg("loginTotpScanBarcode")}</a></p>
                </li>
                <li>
                    <p class="lin-step-t">${msg("loginTotpManualStep3")}</p>
                    <ul class="lin-policy">
                        <li id="kc-totp-type">${msg("loginTotpType")}: ${msg("loginTotp." + totp.policy.type)}</li>
                        <li id="kc-totp-algorithm">${msg("loginTotpAlgorithm")}: ${totp.policy.getAlgorithmKey()}</li>
                        <li id="kc-totp-digits">${msg("loginTotpDigits")}: ${totp.policy.digits}</li>
                        <#if totp.policy.type = "totp">
                            <li id="kc-totp-period">${msg("loginTotpInterval")}: ${totp.policy.period}</li>
                        <#elseif totp.policy.type = "hotp">
                            <li id="kc-totp-counter">${msg("loginTotpCounter")}: ${totp.policy.initialCounter}</li>
                        </#if>
                    </ul>
                </li>
            <#else>
                <li>
                    <p class="lin-step-t">${msg("loginTotpStep2")}</p>
                    <div class="lin-qr">
                        <img id="kc-totp-secret-qr-code" src="data:image/png;base64, ${totp.totpSecretQrCode}" alt="QR code"/>
                    </div>
                    <p><a href="${totp.manualUrl}" id="mode-manual">${msg("loginTotpUnableToScan")}</a></p>
                </li>
            </#if>

            <li>
                <p class="lin-step-t">${msg("loginTotpStep3")}</p>
                <p class="lin-step-d">${msg("loginTotpStep3DeviceName")}</p>
            </li>
        </ol>

        <form action="${url.loginAction}" class="${properties.kcFormClass!}" id="kc-totp-settings-form" method="post">
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcInputWrapperClass!}">
                    <label for="totp" class="control-label">${msg("authenticatorCode")}</label> <span class="required">*</span>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="totp" name="totp" autocomplete="one-time-code"
                           inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="000000"
                           class="${properties.kcInputClass!} lin-otp-code"
                           aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"/>

                    <#if messagesPerField.existsError('totp')>
                        <span id="input-error-otp-code" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                        </span>
                    </#if>
                </div>
                <input type="hidden" id="totpSecret" name="totpSecret" value="${totp.totpSecret}" />
                <#if mode??><input type="hidden" id="mode" name="mode" value="${mode}"/></#if>
            </div>

            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcInputWrapperClass!}">
                    <label for="userLabel" class="control-label">${msg("loginTotpDeviceName")}</label> <#if totp.otpCredentials?size gte 1><span class="required">*</span></#if>
                </div>

                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" class="${properties.kcInputClass!}" id="userLabel" name="userLabel" autocomplete="off"
                           placeholder="Ex : iPhone de Marie"
                           aria-invalid="<#if messagesPerField.existsError('userLabel')>true</#if>"/>

                    <#if messagesPerField.existsError('userLabel')>
                        <span id="input-error-otp-label" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('userLabel'))?no_esc}
                        </span>
                    </#if>
                </div>
            </div>

            <div class="${properties.kcFormGroupClass!}">
                <@passwordCommons.logoutOtherSessions/>
            </div>

            <#if isAppInitiatedAction??>
                <input type="submit"
                       class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                       id="saveTOTPBtn" value="${msg("doSubmit")}"/>
                <button type="submit"
                        class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!} lin-cancel"
                        id="cancelTOTPBtn" name="cancel-aia" value="true">${msg("doCancel")}</button>
            <#else>
                <input type="submit"
                       class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                       id="saveTOTPBtn" value="${msg("doSubmit")}"/>
            </#if>
        </form>
    </#if>
</@layout.registrationLayout>
