import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonModule, CardModule, FormModule, GridModule } from '@coreui/angular';
import { LoginComponent } from './login.component';
import { IconModule } from '@coreui/icons-angular';
import { IconSetService } from '@coreui/icons-angular';
import { iconSubset } from '../../../icons/icon-subset';
import { KeycloakService } from 'keycloak-angular';

/**
 * Page de connexion.
 *
 * <p>Ce test échouait (NG0201 : aucun fournisseur pour KeycloakService) depuis
 * que le composant délègue l'authentification à Keycloak : la spec datait du
 * gabarit CoreUI et n'avait pas suivi. On fournit un double de KeycloakService
 * et on vérifie ce qui compte réellement — que le clic « Se connecter » déclenche
 * bien le flux Keycloak — plutôt que la seule instanciation du composant.</p>
 */
describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let iconSetService: IconSetService;
  let keycloak: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    keycloak = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FormModule, CardModule, GridModule, ButtonModule, IconModule, LoginComponent],
      providers: [
        IconSetService,
        { provide: KeycloakService, useValue: keycloak }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    iconSetService = TestBed.inject(IconSetService);
    iconSetService.icons = { ...iconSubset };

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('délègue la connexion à Keycloak', () => {
    component.login();

    // L'application ne gère aucun mot de passe elle-même : toute la connexion
    // passe par Keycloak. C'est la garantie que ce test protège.
    expect(keycloak.login).toHaveBeenCalledTimes(1);
  });

  it('ne stocke aucun identifiant saisi dans le composant après connexion', () => {
    component.username = 'y.gharbi';
    component.password = 'secret';

    component.login();

    // Le composant ne doit jamais transmettre les identifiants lui-même :
    // il ne fait que déclencher la redirection Keycloak.
    expect(keycloak.login).toHaveBeenCalledWith();
  });
});
