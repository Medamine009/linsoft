import { Component } from '@angular/core';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardGroupComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';
import { FormsModule } from '@angular/forms';
import { KeycloakService } from 'keycloak-angular';
import keycloakConfig from '../../../keycloak.config';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [ContainerComponent, RowComponent, ColComponent, CardGroupComponent, CardComponent, CardBodyComponent, FormDirective, InputGroupComponent, InputGroupTextDirective, IconDirective, FormControlDirective, ButtonDirective, FormsModule]
})
export class LoginComponent {
  username: string = '';
  password: string = '';

  constructor(private keycloak: KeycloakService) {}

  login() {
    this.keycloak.login();
  }

  /**
   * « Mot de passe oublié ? » — redirige vers le formulaire de réinitialisation
   * de Keycloak (flow « reset credentials »), qui envoie le mail de réinitialisation.
   */
  forgotPassword() {
    const redirectUri = window.location.origin + '/dashboard';
    const params = new URLSearchParams({
      client_id: keycloakConfig.clientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid'
    });
    window.location.href =
      `${keycloakConfig.url}/realms/${keycloakConfig.realm}/login-actions/reset-credentials?${params.toString()}`;
  }
}
